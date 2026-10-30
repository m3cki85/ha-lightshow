"""Real-time LightShow Playback Engine for Home Assistant."""

import asyncio
import logging
import time
from typing import Dict, List, Optional, Any
from homeassistant.core import HomeAssistant

from .const import (
    DEFAULT_TICK_RATE,
    EVENT_PROGRESS,
    EVENT_STATE_CHANGED,
)
from .storage import LightShowStorage
from .mass import MusicAssistantHelper

_LOGGER = logging.getLogger(__name__)


class LightShowEngine:
    """Orchestrates lights and audio on a precise millisecond timeline."""

    def __init__(
        self,
        hass: HomeAssistant,
        storage: LightShowStorage,
        mass_helper: MusicAssistantHelper,
    ) -> None:
        self.hass = hass
        self.storage = storage
        self.mass = mass_helper

        self._state: str = "idle"  # idle, playing, paused, stopped
        self._current_show: Optional[Dict[str, Any]] = None
        self._current_show_id: Optional[str] = None
        self._player_entity_id: Optional[str] = None
        self._task: Optional[asyncio.Task] = None

        self._current_time: float = 0.0
        self._duration: float = 0.0
        self._loop: bool = False
        self._fade_out_on_stop: bool = False

        self._pause_event = asyncio.Event()
        self._pause_event.set()

    @property
    def state(self) -> str:
        """Current playback state."""
        return self._state

    @property
    def current_time(self) -> float:
        """Current position in seconds."""
        return self._current_time

    @property
    def duration(self) -> float:
        """Total duration of the current show in seconds."""
        return self._duration

    @property
    def current_show_id(self) -> Optional[str]:
        """ID of currently loaded show."""
        return self._current_show_id

    def get_status(self) -> Dict[str, Any]:
        """Return full status dictionary."""
        return {
            "state": self._state,
            "show_id": self._current_show_id,
            "show_name": self._current_show.get("name") if self._current_show else None,
            "current_time": round(self._current_time, 3),
            "duration": round(self._duration, 3),
            "player_entity_id": self._player_entity_id,
            "loop": self._loop,
        }

    async def async_play(
        self,
        show_id: str,
        player_entity_id: Optional[str] = None,
        loop: Optional[bool] = None,
        start_time: float = 0.0,
    ) -> bool:
        """Start or restart playing a lightshow."""
        # Stop existing show if running
        await self.async_stop()

        show_data = await self.storage.async_get_show(show_id)
        if not show_data:
            _LOGGER.error("Cannot play show: '%s' not found", show_id)
            return False

        self._current_show = show_data
        self._current_show_id = show_id

        settings = show_data.get("settings", {})
        self._loop = loop if loop is not None else settings.get("loop", False)
        self._fade_out_on_stop = settings.get("fade_out_on_stop", True)

        # Determine target player
        self._player_entity_id = (
            player_entity_id
            or settings.get("default_player_entity_id")
        )

        # Determine duration
        audio_info = show_data.get("audio", {})
        tracks = show_data.get("tracks", [])
        max_cue_time = 0.0
        for track in tracks:
            for cue in track.get("cues", []):
                t = float(cue.get("time", 0.0))
                dur = float(cue.get("transition", 0.0))
                if t + dur > max_cue_time:
                    max_cue_time = t + dur

        self._duration = float(audio_info.get("duration", 0.0))
        if self._duration <= 0 or max_cue_time > self._duration:
            self._duration = max_cue_time if max_cue_time > 0 else 60.0

        self._current_time = max(0.0, start_time)
        self._set_state("playing")

        # Launch playback task
        self._pause_event.set()
        self._task = asyncio.create_task(self._playback_loop(start_time))
        return True

    async def async_stop(self) -> None:
        """Stop playback and reset state."""
        if self._state == "idle" and not self._task:
            return

        self._set_state("stopped")
        self._pause_event.set()

        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._task = None

        # Stop audio on player
        if self._player_entity_id:
            await self.mass.async_stop_media(self._player_entity_id)

        # Optional graceful fade out
        if self._fade_out_on_stop and self._current_show:
            await self._fade_out_lights()

        self._current_time = 0.0
        self._set_state("idle")

    async def async_pause(self) -> None:
        """Pause playback."""
        if self._state == "playing":
            self._set_state("paused")
            self._pause_event.clear()
            if self._player_entity_id:
                await self.mass.async_pause_media(self._player_entity_id)

    async def async_resume(self) -> None:
        """Resume playback."""
        if self._state == "paused":
            self._set_state("playing")
            self._pause_event.set()
            if self._player_entity_id and self._current_show:
                audio = self._current_show.get("audio", {})
                media_id = audio.get("mass_uri") or audio.get("stream_url")
                if media_id:
                    await self.mass.async_play_media(self._player_entity_id, media_id)

    async def async_test_cue(self, entity_id: str, cue: Dict[str, Any]) -> None:
        """Instantly apply a cue to a lamp (used for live preview in the studio editor)."""
        await self._dispatch_cue_to_light(entity_id, cue)

    def _set_state(self, new_state: str) -> None:
        """Update state and fire Home Assistant event."""
        if self._state != new_state:
            self._state = new_state
            self.hass.bus.async_fire(
                EVENT_STATE_CHANGED,
                {
                    "state": self._state,
                    "show_id": self._current_show_id,
                    "current_time": self._current_time,
                },
            )

    async def _playback_loop(self, start_offset: float = 0.0) -> None:
        """The main high-resolution playback tick loop."""
        loop = asyncio.get_running_loop()

        # Prepare cues
        tracks = self._current_show.get("tracks", []) if self._current_show else []
        flattened_cues: List[Dict[str, Any]] = []

        for track in tracks:
            entity_id = track.get("entity_id")
            if not entity_id:
                continue
            track_type = track.get("type", "standard")
            for cue in track.get("cues", []):
                cue_time = float(cue.get("time", 0.0))
                flattened_cues.append({
                    "time": cue_time,
                    "entity_id": entity_id,
                    "track_type": track_type,
                    "cue": cue,
                })

        flattened_cues.sort(key=lambda x: x["time"])

        # Start audio if configured
        if self._player_entity_id and self._current_show:
            audio = self._current_show.get("audio", {})
            media_id = audio.get("mass_uri") or audio.get("stream_url")
            if media_id:
                await self.mass.async_play_media(self._player_entity_id, media_id)

        t_start = loop.time() - start_offset
        cue_idx = 0
        # Fast-forward cue index if starting with offset
        while cue_idx < len(flattened_cues) and flattened_cues[cue_idx]["time"] < start_offset:
            cue_idx += 1

        last_progress_event_time = 0.0

        try:
            while self._state == "playing":
                # Handle pause
                if not self._pause_event.is_set():
                    pause_start = loop.time()
                    await self._pause_event.wait()
                    # Compensate for time spent paused
                    t_start += (loop.time() - pause_start)

                now = loop.time()
                elapsed = now - t_start
                self._current_time = elapsed

                # Dispatch cues ready at current timestamp
                while cue_idx < len(flattened_cues) and flattened_cues[cue_idx]["time"] <= elapsed:
                    item = flattened_cues[cue_idx]
                    self.hass.async_create_task(
                        self._dispatch_cue_to_light(item["entity_id"], item["cue"])
                    )
                    cue_idx += 1

                # Progress broadcast every ~200ms
                if now - last_progress_event_time >= 0.2:
                    last_progress_event_time = now
                    self.hass.bus.async_fire(
                        EVENT_PROGRESS,
                        {
                            "show_id": self._current_show_id,
                            "current_time": round(self._current_time, 2),
                            "duration": round(self._duration, 2),
                            "state": self._state,
                        },
                    )

                # Check if show finished
                if elapsed >= self._duration:
                    if self._loop:
                        # Reset for next loop
                        t_start = loop.time()
                        cue_idx = 0
                        self._current_time = 0.0
                        if self._player_entity_id and self._current_show:
                            audio = self._current_show.get("audio", {})
                            media_id = audio.get("mass_uri") or audio.get("stream_url")
                            if media_id:
                                await self.mass.async_play_media(self._player_entity_id, media_id)
                    else:
                        _LOGGER.info("Lightshow '%s' finished naturally", self._current_show_id)
                        break

                await asyncio.sleep(DEFAULT_TICK_RATE)

        except asyncio.CancelledError:
            pass
        except Exception as err:
            _LOGGER.exception("Error in lightshow playback loop: %s", err)
        finally:
            if self._state == "playing":
                await self.async_stop()

    async def _dispatch_cue_to_light(self, entity_id: str, cue: Dict[str, Any]) -> None:
        """Send command to light entity with appropriate capabilities."""
        action = cue.get("state", "on").lower()
        transition = float(cue.get("transition", 0.0))

        if action == "off":
            service_data: Dict[str, Any] = {"entity_id": entity_id}
            if transition > 0:
                service_data["transition"] = transition
            await self.hass.services.async_call("light", "turn_off", service_data, blocking=False)
            return

        # Turn ON / change attributes
        service_data = {"entity_id": entity_id}

        if transition > 0:
            service_data["transition"] = transition

        # Brightness (0-255)
        if "brightness" in cue and cue["brightness"] is not None:
            service_data["brightness"] = int(cue["brightness"])
        elif "brightness_pct" in cue and cue["brightness_pct"] is not None:
            service_data["brightness_pct"] = int(cue["brightness_pct"])

        # Color (RGB list, e.g. [255, 0, 128])
        if "rgb_color" in cue and cue["rgb_color"]:
            rgb = cue["rgb_color"]
            if isinstance(rgb, list) and len(rgb) == 3:
                service_data["rgb_color"] = [int(c) for c in rgb]

        # Color Temperature (kelvin or mireds)
        if "color_temp_kelvin" in cue and cue["color_temp_kelvin"]:
            service_data["color_temp_kelvin"] = int(cue["color_temp_kelvin"])

        # WLED or light effect
        if "effect" in cue and cue["effect"]:
            service_data["effect"] = str(cue["effect"])

        try:
            await self.hass.services.async_call("light", "turn_on", service_data, blocking=False)
        except Exception as err:
            _LOGGER.warning("Could not dispatch cue to %s: %s", entity_id, err)

    async def _fade_out_lights(self) -> None:
        """Fade out all lights involved in current show."""
        if not self._current_show:
            return
        for track in self._current_show.get("tracks", []):
            eid = track.get("entity_id")
            if eid:
                try:
                    await self.hass.services.async_call(
                        "light",
                        "turn_off",
                        {"entity_id": eid, "transition": 1.5},
                        blocking=False,
                    )
                except Exception:
                    pass

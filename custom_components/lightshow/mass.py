"""Music Assistant integration helper."""

import logging
from typing import Dict, List, Optional, Any
from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)


class MusicAssistantHelper:
    """Helper to communicate with Music Assistant and Home Assistant media players."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass

    def get_players(self) -> List[Dict[str, Any]]:
        """Return all available media_player entities, prioritizing Music Assistant players."""
        players = []
        for state in self.hass.states.async_all("media_player"):
            attrs = state.attributes
            entity_id = state.entity_id
            friendly_name = attrs.get("friendly_name", entity_id)

            # Detect if it is a Music Assistant player
            is_mass = False
            if "mass_player_type" in attrs or "mass_player_id" in attrs:
                is_mass = True
            elif attrs.get("app_name") == "Music Assistant":
                is_mass = True
            elif "music_assistant" in str(state.context).lower():
                is_mass = True
            elif "mass" in entity_id.lower():
                is_mass = True

            players.append({
                "entity_id": entity_id,
                "name": friendly_name,
                "is_mass": is_mass,
                "state": state.state,
                "volume_level": attrs.get("volume_level"),
                "media_title": attrs.get("media_title"),
                "media_artist": attrs.get("media_artist"),
                "supported_features": attrs.get("supported_features", 0),
            })

        # Sort so Music Assistant players appear at top
        players.sort(key=lambda p: (not p["is_mass"], p["name"].lower()))
        return players

    async def async_play_media(
        self,
        player_entity_id: str,
        media_id: str,
        media_type: str = "music",
        enqueue: bool = False,
    ) -> bool:
        """Start media playback on the specified player via MASS or media_player service."""
        try:
            # If target media is explicitly MASS and music_assistant service exists
            if media_id.startswith(("media-source://mass", "library://")) and self.hass.services.has_service("music_assistant", "play_media"):
                await self.hass.services.async_call(
                    "music_assistant",
                    "play_media",
                    {
                        "entity_id": player_entity_id,
                        "media_id": media_id,
                        "media_type": media_type,
                    },
                    blocking=False,
                )
                _LOGGER.info("Called music_assistant.play_media for %s with %s", player_entity_id, media_id)
                return True

            # Universal standard media_player.play_media (works for Alexa / Echo Dot, Kiosk Assist, Cast, Sonos)
            await self.hass.services.async_call(
                "media_player",
                "play_media",
                {
                    "entity_id": player_entity_id,
                    "media_content_id": media_id,
                    "media_content_type": "music",
                },
                blocking=False,
            )
            _LOGGER.info("Called media_player.play_media for %s with %s", player_entity_id, media_id)
            return True

        except Exception as err:
            _LOGGER.error("Failed to start playback on %s: %s", player_entity_id, err)
            return False

    async def async_stop_media(self, player_entity_id: str) -> bool:
        """Stop playback on player."""
        try:
            await self.hass.services.async_call(
                "media_player",
                "media_stop",
                {"entity_id": player_entity_id},
                blocking=False,
            )
            return True
        except Exception as err:
            _LOGGER.warning("Failed to stop media on %s: %s", player_entity_id, err)
            return False

    async def async_pause_media(self, player_entity_id: str) -> bool:
        """Pause playback on player."""
        try:
            await self.hass.services.async_call(
                "media_player",
                "media_pause",
                {"entity_id": player_entity_id},
                blocking=False,
            )
            return True
        except Exception as err:
            _LOGGER.warning("Failed to pause media on %s: %s", player_entity_id, err)
            return False

    def get_active_tracks(self) -> List[Dict[str, Any]]:
        """Return tracks currently playing, paused or recently active on any media player."""
        active = []
        for state in self.hass.states.async_all("media_player"):
            attrs = state.attributes
            title = attrs.get("media_title")
            if title and state.state in ("playing", "paused", "idle", "standby", "on"):
                is_mass = False
                if "mass_player_type" in attrs or "mass_player_id" in attrs:
                    is_mass = True
                elif attrs.get("app_name") == "Music Assistant":
                    is_mass = True
                elif "mass" in state.entity_id.lower():
                    is_mass = True

                duration = attrs.get("media_duration")
                media_content_id = attrs.get("media_content_id")
                if not media_content_id:
                    media_content_id = f"media-source://mass/player/{state.entity_id}"

                active.append({
                    "player_entity_id": state.entity_id,
                    "player_name": attrs.get("friendly_name", state.entity_id),
                    "state": state.state,
                    "title": title,
                    "artist": attrs.get("media_artist", ""),
                    "album": attrs.get("media_album_name", ""),
                    "duration": float(duration) if duration else 0.0,
                    "media_content_id": media_content_id,
                    "image": attrs.get("entity_picture"),
                    "is_mass": is_mass,
                })

        # Sort priority: playing > paused > idle > other, and is_mass first
        state_priority = {"playing": 0, "paused": 1, "idle": 2, "standby": 3}
        active.sort(key=lambda x: (state_priority.get(x["state"], 4), not x["is_mass"], x["player_name"]))
        return active

    async def async_search(self, query: str, limit: int = 25) -> List[Dict[str, Any]]:
        """Direct native search using Music Assistant action or active players."""
        results = []
        if not query or not query.strip():
            return results

        q = query.strip()

        # 1. Native music_assistant.search action in Home Assistant
        if self.hass.services.has_service("music_assistant", "search"):
            for media_type_param in (["track"], "track"):
                try:
                    res = await self.hass.services.async_call(
                        domain="music_assistant",
                        service="search",
                        service_data={"name": q, "media_type": media_type_param, "limit": limit},
                        blocking=True,
                        return_response=True,
                    )
                    if res and isinstance(res, dict):
                        tracks_list = res.get("tracks")
                        if not tracks_list:
                            # Nested under instance or domain dictionary
                            for v in res.values():
                                if isinstance(v, dict) and "tracks" in v:
                                    tracks_list = v["tracks"]
                                    break
                                elif isinstance(v, list) and v and isinstance(v[0], dict) and ("uri" in v[0] or "item_id" in v[0]):
                                    tracks_list = v
                                    break

                        if tracks_list and isinstance(tracks_list, list):
                            for item in tracks_list:
                                artists = item.get("artists", [])
                                if isinstance(artists, list):
                                    artist_name = ", ".join(
                                        a.get("name", "") if isinstance(a, dict) else str(a)
                                        for a in artists
                                    )
                                else:
                                    artist_name = str(artists)

                                album_name = ""
                                album = item.get("album")
                                if isinstance(album, dict):
                                    album_name = album.get("name", "")
                                elif isinstance(album, str):
                                    album_name = album

                                uri = item.get("uri")
                                item_id = item.get("item_id") or item.get("id")
                                if not uri and item_id:
                                    uri = f"media-source://mass/track/{item_id}"

                                duration = item.get("duration")
                                image = item.get("image")
                                if isinstance(image, dict):
                                    image = image.get("path") or image.get("url")

                                results.append({
                                    "title": item.get("name") or item.get("title") or "Unbekannter Titel",
                                    "artist": artist_name,
                                    "album": album_name,
                                    "duration": float(duration) if duration else 0.0,
                                    "media_content_id": uri,
                                    "image": image,
                                    "can_play": True,
                                    "can_expand": False,
                                    "media_class": "track",
                                })

                            if results:
                                _LOGGER.info("music_assistant.search successfully returned %d tracks for '%s'", len(results), q)
                                return results
                except Exception as err:
                    _LOGGER.debug("music_assistant.search attempt failed with param %s: %s", media_type_param, err)

        # 2. Match from currently active tracks as quick fallback
        for a in self.get_active_tracks():
            if q.lower() in a["title"].lower() or q.lower() in a["artist"].lower() or q.lower() in a["album"].lower():
                results.append({
                    "title": a["title"],
                    "artist": a["artist"],
                    "album": a["album"],
                    "duration": a["duration"],
                    "media_content_id": a["media_content_id"],
                    "image": a["image"],
                    "can_play": True,
                    "can_expand": False,
                    "media_class": "track",
                })

        return results

    async def async_browse_media_source(self, identifier: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Browse Home Assistant media sources (including Music Assistant & Local Media)."""
        try:
            from homeassistant.components import media_source
            media = await media_source.async_browse_media(
                self.hass,
                identifier or None,
            )
            return media.as_dict()
        except Exception as err:
            _LOGGER.warning("Could not browse media_source for %s: %s", identifier, err)
            return None

    async def async_resolve_media(self, media_content_id: str) -> Optional[Dict[str, Any]]:
        """Resolve media identifier to a playable/streamable audio URL."""
        try:
            from homeassistant.components import media_source

            # First attempt: direct resolve
            try:
                resolved = await media_source.async_resolve_media(
                    self.hass,
                    media_content_id,
                    None,
                )
                if resolved and resolved.url:
                    return {
                        "url": resolved.url,
                        "mime_type": resolved.mime_type,
                    }
            except Exception as direct_err:
                _LOGGER.debug("Direct resolve of %s failed: %s, trying prefix fallback", media_content_id, direct_err)

            # Fallback attempt: if not starting with media-source://, try media-source://mass/
            if not media_content_id.startswith("media-source://"):
                clean_id = media_content_id.lstrip("/")
                fallback_id = f"media-source://mass/{clean_id}"
                resolved = await media_source.async_resolve_media(
                    self.hass,
                    fallback_id,
                    None,
                )
                if resolved and resolved.url:
                    return {
                        "url": resolved.url,
                        "mime_type": resolved.mime_type,
                    }

            return None
        except Exception as err:
            _LOGGER.error("Failed to resolve media %s: %s", media_content_id, err)
            return None

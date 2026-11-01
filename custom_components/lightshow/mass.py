"""Music Assistant integration helper."""

import os
import asyncio
import logging
from typing import Dict, List, Optional, Any, Set
from urllib.parse import quote, unquote
from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)


class MusicAssistantHelper:
    """Helper to communicate with Music Assistant and Home Assistant media players."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass

    def _extract_item_details(self, item_obj: Any) -> Dict[str, Any]:
        """Extract rich provider and track metadata from a Music Assistant item object."""
        res: Dict[str, Any] = {
            "title": "",
            "artist": "",
            "album": "",
            "duration": 0.0,
            "uri": "",
            "image": None,
            "provider": "",
            "provider_label": "Music Assistant",
            "file_path": "",
            "provider_mappings": [],
        }
        if not item_obj:
            return res

        # Title
        res["title"] = getattr(item_obj, "name", "") or getattr(item_obj, "title", "")

        # Artists
        artists = getattr(item_obj, "artists", [])
        if isinstance(artists, list):
            res["artist"] = ", ".join(getattr(a, "name", str(a)) for a in artists)
        elif artists:
            res["artist"] = str(artists)

        # Album
        album_obj = getattr(item_obj, "album", None)
        if album_obj:
            res["album"] = getattr(album_obj, "name", str(album_obj))

        # Duration
        res["duration"] = float(getattr(item_obj, "duration", 0) or 0)

        # URI & Image
        res["uri"] = getattr(item_obj, "uri", "")
        res["image"] = getattr(item_obj, "image_url", None) or getattr(item_obj, "image", None)

        # Provider
        prov = getattr(item_obj, "provider", "") or getattr(item_obj, "provider_domain", "")
        if prov:
            res["provider"] = str(prov).lower()

        # Check media_item wrapper if present
        m_item = getattr(item_obj, "media_item", None)
        if m_item:
            if not res["title"]:
                res["title"] = getattr(m_item, "name", "") or getattr(m_item, "title", "")
            if not res["artist"]:
                m_artists = getattr(m_item, "artists", [])
                if isinstance(m_artists, list):
                    res["artist"] = ", ".join(getattr(a, "name", str(a)) for a in m_artists)
                elif m_artists:
                    res["artist"] = str(m_artists)
            if not res["album"] and getattr(m_item, "album", None):
                res["album"] = getattr(m_item.album, "name", str(m_item.album))
            if not res["duration"]:
                res["duration"] = float(getattr(m_item, "duration", 0) or 0)
            if not res["uri"]:
                res["uri"] = getattr(m_item, "uri", "") or getattr(m_item, "item_id", "")
            if not res["image"]:
                res["image"] = getattr(m_item, "image", None)
            if not res["provider"]:
                res["provider"] = str(getattr(m_item, "provider", "")).lower()

        # Fallback to item_id if uri is missing
        if not res["uri"]:
            item_id = getattr(item_obj, "item_id", None) or getattr(item_obj, "id", None)
            if item_id:
                res["uri"] = f"media-source://mass/track/{item_id}"

        # Inspect provider_mappings for direct file paths or provider streaming links
        mappings_source = (
            getattr(item_obj, "provider_mappings", None)
            or (getattr(m_item, "provider_mappings", None) if m_item else None)
        )
        if mappings_source:
            raw_mappings = list(mappings_source) if hasattr(mappings_source, "__iter__") else [mappings_source]
            for m in raw_mappings:
                m_prov = str(
                    getattr(m, "provider_domain", "")
                    or getattr(m, "provider", "")
                    or (m.get("provider_domain") if isinstance(m, dict) else "")
                ).lower()
                m_id = str(
                    getattr(m, "item_id", "")
                    or (m.get("item_id") if isinstance(m, dict) else "")
                )
                m_url = str(
                    getattr(m, "url", "")
                    or (m.get("url") if isinstance(m, dict) else "")
                )
                res["provider_mappings"].append({
                    "provider": m_prov,
                    "item_id": m_id,
                    "url": m_url,
                })
                if not res["provider"] and m_prov:
                    res["provider"] = m_prov

                # Check if this mapping points to a local file or share path
                if any(x in m_prov for x in ("filesystem", "file", "smb", "nfs", "webdav", "local")):
                    if m_id and (
                        m_id.startswith(("/", "\\"))
                        or ":" in m_id
                        or any(m_id.lower().endswith(ext) for ext in (".mp3", ".flac", ".wav", ".m4a", ".ogg", ".aac"))
                    ):
                        res["file_path"] = m_id

        # Determine human-readable provider label
        p_str = (res["provider"] + " " + res["uri"]).lower()
        if "plex" in p_str:
            res["provider_label"] = "Plex"
        elif "jellyfin" in p_str:
            res["provider_label"] = "Jellyfin"
        elif any(x in p_str for x in ("subsonic", "opensubsonic", "navidrome", "gonic", "airsonic")):
            res["provider_label"] = "Subsonic / Navidrome"
        elif "emby" in p_str:
            res["provider_label"] = "Emby"
        elif any(x in p_str for x in ("filesystem", "file://", "smb://", "nfs://", "webdav://", "local")):
            res["provider_label"] = "Lokale Datei (SMB/Disk)"
        else:
            res["provider_label"] = "Music Assistant"

        return res

    def _get_mass_client(self) -> Optional[Any]:
        """Retrieve the official MusicAssistantClient instance from Home Assistant."""
        # 1. Config entries (modern HA pattern)
        for domain in ("music_assistant", "mass"):
            for entry in self.hass.config_entries.async_entries(domain):
                runtime_data = getattr(entry, "runtime_data", None)
                if runtime_data:
                    client = getattr(runtime_data, "mass", runtime_data)
                    if hasattr(client, "player_queues") or hasattr(client, "players"):
                        return client
                # Legacy entry data
                entry_data = self.hass.data.get(domain, {})
                if isinstance(entry_data, dict):
                    client = entry_data.get(entry.entry_id) or entry_data.get("mass")
                    if client and (hasattr(client, "player_queues") or hasattr(client, "players")):
                        return client

        # 2. Global hass.data
        for key in ("mass", "music_assistant"):
            if key in self.hass.data:
                obj = self.hass.data[key]
                if hasattr(obj, "player_queues") or hasattr(obj, "players"):
                    return obj
                elif isinstance(obj, dict):
                    for v in obj.values():
                        client = getattr(v, "mass", v)
                        if hasattr(client, "player_queues") or hasattr(client, "players"):
                            return client
        return None

    def _get_mass_server_url(self) -> Optional[str]:
        """Get the base HTTP URL of the Music Assistant server."""
        # 1. From client
        client = self._get_mass_client()
        if client:
            url = (
                getattr(client, "server_url", None)
                or getattr(client, "_server_url", None)
                or getattr(getattr(client, "connection", None), "server_url", None)
            )
            if url:
                return str(url).rstrip("/")
            ws_url = getattr(getattr(client, "connection", None), "ws_server_url", "")
            if ws_url:
                clean_ws = str(ws_url).replace("wss://", "https://").replace("ws://", "http://").replace("/ws", "")
                return clean_ws.rstrip("/")

        # 2. From config entries
        for domain in ("music_assistant", "mass"):
            for entry in self.hass.config_entries.async_entries(domain):
                url = entry.data.get("url")
                if url:
                    return str(url).rstrip("/")
        return None

    def get_mass_server_queues(self) -> List[Dict[str, Any]]:
        """Retrieve all active players and queues directly from Music Assistant client."""
        client = self._get_mass_client()
        if not client:
            return []

        results = []
        seen_ids = set()

        # 1. Inspect client.players (all registered players in Music Assistant)
        players_controller = getattr(client, "players", None)
        if players_controller:
            raw_players = []
            try:
                if hasattr(players_controller, "all") and callable(getattr(players_controller, "all")):
                    raw_players = list(players_controller.all())
                elif hasattr(players_controller, "players"):
                    p_attr = getattr(players_controller, "players")
                    raw_players = list(p_attr.values()) if isinstance(p_attr, dict) else list(p_attr)
                elif hasattr(players_controller, "_players"):
                    raw_players = list(getattr(players_controller, "_players").values())
                elif isinstance(players_controller, dict):
                    raw_players = list(players_controller.values())
                else:
                    raw_players = list(players_controller)
            except Exception as err:
                _LOGGER.debug("Error retrieving client.players: %s", err)

            if not raw_players:
                try:
                    raw_players = list(players_controller)
                except Exception:
                    pass

            for p in raw_players:
                p_id = str(getattr(p, "player_id", "") or "")
                if not p_id:
                    continue
                display_name = getattr(p, "display_name", "") or getattr(p, "name", p_id)
                state = str(getattr(p, "state", "idle")).lower()

                # Check current_media on player
                cur_media = getattr(p, "current_media", None) or getattr(p, "media", None)
                details = self._extract_item_details(cur_media)

                # Check player_queues for active item if not on player directly
                if not details["title"] and hasattr(client, "player_queues"):
                    q = None
                    try:
                        q_ctrl = client.player_queues
                        active_source = getattr(p, "active_source", None) or p_id
                        if hasattr(q_ctrl, "get") and callable(q_ctrl.get):
                            q = q_ctrl.get(active_source) or q_ctrl.get(p_id)
                        elif isinstance(q_ctrl, dict):
                            q = q_ctrl.get(active_source) or q_ctrl.get(p_id)
                        elif hasattr(q_ctrl, "queues"):
                            q = q_ctrl.queues.get(active_source) or q_ctrl.queues.get(p_id)
                        elif hasattr(q_ctrl, "_queues"):
                            q = q_ctrl._queues.get(active_source) or q_ctrl._queues.get(p_id)
                    except Exception:
                        pass

                    if q and getattr(q, "current_item", None):
                        details = self._extract_item_details(q.current_item)

                seen_ids.add(p_id)
                seen_ids.add(display_name.lower())
                entity_id = f"media_player.mass_{p_id}" if not str(p_id).startswith("media_player.") else p_id

                results.append({
                    "queue_id": p_id,
                    "player_entity_id": entity_id,
                    "player_name": display_name,
                    "state": state,
                    "title": details["title"] or "Bereit (Music Assistant)",
                    "artist": details["artist"],
                    "album": details["album"],
                    "duration": details["duration"],
                    "media_content_id": details["uri"] or f"media-source://mass/player/{p_id}",
                    "image": details["image"],
                    "has_track": bool(details["title"]),
                    "is_mass": True,
                    "provider": details["provider"],
                    "provider_label": details["provider_label"],
                    "file_path": details["file_path"],
                    "provider_mappings": details["provider_mappings"],
                })

        # 2. Inspect client.player_queues (catch any standalone queues)
        queues_controller = getattr(client, "player_queues", None)
        if queues_controller:
            raw_queues = []
            try:
                if hasattr(queues_controller, "all") and callable(getattr(queues_controller, "all")):
                    raw_queues = list(queues_controller.all())
                elif hasattr(queues_controller, "queues"):
                    q_attr = getattr(queues_controller, "queues")
                    raw_queues = list(q_attr.values()) if isinstance(q_attr, dict) else list(q_attr)
                elif hasattr(queues_controller, "_queues"):
                    raw_queues = list(getattr(queues_controller, "_queues").values())
                elif isinstance(queues_controller, dict):
                    raw_queues = list(queues_controller.values())
                else:
                    raw_queues = list(queues_controller)
            except Exception as err:
                _LOGGER.debug("Error retrieving client.player_queues: %s", err)

            if not raw_queues:
                try:
                    raw_queues = list(queues_controller)
                except Exception:
                    pass

            for q in raw_queues:
                queue_id = str(getattr(q, "queue_id", None) or getattr(q, "player_id", "") or "")
                display_name = getattr(q, "display_name", "") or getattr(q, "name", str(queue_id))
                if not queue_id or queue_id in seen_ids or display_name.lower() in seen_ids:
                    continue
                seen_ids.add(queue_id)
                seen_ids.add(display_name.lower())

                current_item = getattr(q, "current_item", None)
                state = str(getattr(q, "state", "idle")).lower()
                details = self._extract_item_details(current_item)

                entity_id = f"media_player.mass_{queue_id}" if not str(queue_id).startswith("media_player.") else queue_id
                results.append({
                    "queue_id": queue_id,
                    "player_entity_id": entity_id,
                    "player_name": display_name or f"Music Assistant ({queue_id})",
                    "state": state,
                    "title": details["title"] or "Bereit (Music Assistant)",
                    "artist": details["artist"],
                    "album": details["album"],
                    "duration": details["duration"],
                    "media_content_id": details["uri"] or f"media-source://mass/player/{queue_id}",
                    "image": details["image"],
                    "has_track": bool(details["title"]),
                    "is_mass": True,
                    "provider": details["provider"],
                    "provider_label": details["provider_label"],
                    "file_path": details["file_path"],
                    "provider_mappings": details["provider_mappings"],
                })

        return results

    def get_players(self) -> List[Dict[str, Any]]:
        """Return all available media_player entities, prioritizing Music Assistant players."""
        players = []
        seen = set()

        # 0. Entity registry lookup to reliably tag MASS players
        mass_entity_ids = set()
        try:
            from homeassistant.helpers import entity_registry as er
            ent_reg = er.async_get(self.hass)
            for entity_id, reg_entry in ent_reg.entities.items():
                if reg_entry.domain == "media_player" and reg_entry.platform in ("mass", "music_assistant"):
                    mass_entity_ids.add(entity_id)
        except Exception:
            pass

        # 1. Native Music Assistant server players & queues
        for q in self.get_mass_server_queues():
            entity_id = q["player_entity_id"]
            if entity_id not in seen:
                seen.add(entity_id)
                seen.add(q["player_name"].lower())
                players.append({
                    "entity_id": entity_id,
                    "name": q["player_name"],
                    "is_mass": True,
                    "state": q["state"],
                    "media_title": q["title"] if q.get("has_track") else "",
                    "media_artist": q.get("artist", ""),
                })

        # 2. Home Assistant media_player states
        for state in self.hass.states.async_all("media_player"):
            attrs = state.attributes
            entity_id = state.entity_id
            friendly_name = attrs.get("friendly_name", entity_id)

            is_mass = False
            if entity_id in mass_entity_ids:
                is_mass = True
            elif "mass_player_type" in attrs or "mass_player_id" in attrs:
                is_mass = True
            elif attrs.get("app_name") == "Music Assistant":
                is_mass = True
            elif "music_assistant" in str(state.context).lower():
                is_mass = True
            elif "mass" in entity_id.lower():
                is_mass = True

            if entity_id in seen or friendly_name.lower() in seen:
                continue
            seen.add(entity_id)
            seen.add(friendly_name.lower())

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
        media_id: Optional[str] = None,
        track_title: Optional[str] = None,
        media_type: Optional[str] = None,
        enqueue: str = "replace",
        start_time: float = 0.0,
    ) -> bool:
        """Start media playback on the specified player via Music Assistant or Home Assistant."""
        if not player_entity_id:
            _LOGGER.warning("async_play_media called without player_entity_id")
            return False

        def _schedule_seek():
            if start_time > 0:
                async def _delayed():
                    await asyncio.sleep(0.5)
                    await self.async_seek_media(player_entity_id, start_time)
                self.hass.async_create_task(_delayed())

        # 1. Determine best play target
        play_target = None
        if media_id and not str(media_id).startswith("media-source://mass/player/"):
            play_target = media_id

        # If media_id is a player reference or empty, check active tracks for real URI or title
        if not play_target or str(play_target).startswith("media-source://mass/player/"):
            for a in self.get_active_tracks():
                if (
                    player_entity_id in (a.get("player_entity_id"), a.get("queue_id"))
                    or (media_id and media_id in (a.get("media_content_id"), a.get("player_entity_id"), a.get("queue_id")))
                ):
                    candidate_id = a.get("media_content_id")
                    if candidate_id and not str(candidate_id).startswith("media-source://mass/player/"):
                        play_target = candidate_id
                        break
                    if a.get("title") and not track_title:
                        track_title = a.get("title")

        # Fallback to track_title if no URI is available
        if not play_target and track_title:
            play_target = track_title

        _LOGGER.info(
            "async_play_media on %s with target: %s (original media_id: %s, title: %s, start_time: %.1f)",
            player_entity_id,
            play_target,
            media_id,
            track_title,
            start_time,
        )

        # 2. Direct Music Assistant Client (native WebSocket protocol)
        client = self._get_mass_client()
        if client and hasattr(client, "player_queues") and hasattr(client.player_queues, "play_media"):
            try:
                queue_id = None
                clean_id = player_entity_id.replace("media_player.mass_", "").replace("media_player.", "")
                players_ctrl = getattr(client, "players", None)
                if players_ctrl:
                    raw_players = []
                    if hasattr(players_ctrl, "all") and callable(players_ctrl.all):
                        raw_players = list(players_ctrl.all())
                    elif hasattr(players_ctrl, "players"):
                        p_dict = players_ctrl.players
                        raw_players = list(p_dict.values()) if isinstance(p_dict, dict) else list(p_dict)
                    elif isinstance(players_ctrl, dict):
                        raw_players = list(players_ctrl.values())
                    elif hasattr(players_ctrl, "__iter__"):
                        try:
                            raw_players = list(players_ctrl)
                        except Exception:
                            pass

                    for p in raw_players:
                        p_id = str(getattr(p, "player_id", "") or "")
                        disp = str(getattr(p, "display_name", "") or getattr(p, "name", "")).lower()
                        if p_id == clean_id or disp == clean_id.lower() or f"media_player.mass_{p_id}" == player_entity_id:
                            queue_id = getattr(p, "active_source", None) or p_id
                            break

                if not queue_id:
                    queue_id = clean_id

                if play_target:
                    await client.player_queues.play_media(
                        queue_id=queue_id,
                        media=play_target,
                        option="replace",
                    )
                    _LOGGER.info("Direct client.player_queues.play_media succeeded for queue '%s' with '%s'", queue_id, play_target)
                    _schedule_seek()
                    return True
                else:
                    if hasattr(client.player_queues, "resume"):
                        await client.player_queues.resume(queue_id)
                        _LOGGER.info("Direct client.player_queues.resume succeeded for queue '%s'", queue_id)
                        _schedule_seek()
                        return True
                    elif hasattr(client.player_queues, "play"):
                        await client.player_queues.play(queue_id)
                        _LOGGER.info("Direct client.player_queues.play succeeded for queue '%s'", queue_id)
                        _schedule_seek()
                        return True

            except Exception as client_err:
                _LOGGER.debug("Direct client.player_queues call failed: %s, falling back to HA actions", client_err)

        # 3. Official Home Assistant action `music_assistant.play_media` / `mass.play_media`
        for s_domain in ("music_assistant", "mass"):
            if self.hass.services.has_service(s_domain, "play_media"):
                if play_target:
                    try:
                        await self.hass.services.async_call(
                            s_domain,
                            "play_media",
                            service_data={
                                "media_id": play_target,
                                "enqueue": "replace",
                            },
                            target={"entity_id": player_entity_id},
                            blocking=False,
                        )
                        _LOGGER.info("Called %s.play_media with target %s for %s", s_domain, player_entity_id, play_target)
                        _schedule_seek()
                        return True
                    except Exception as err:
                        _LOGGER.debug("%s.play_media with target failed: %s, trying legacy data format", s_domain, err)
                        try:
                            await self.hass.services.async_call(
                                s_domain,
                                "play_media",
                                service_data={
                                    "entity_id": player_entity_id,
                                    "media_id": play_target,
                                    "enqueue": "replace",
                                },
                                blocking=False,
                            )
                            _LOGGER.info("Called legacy %s.play_media for %s with %s", s_domain, player_entity_id, play_target)
                            _schedule_seek()
                            return True
                        except Exception as leg_err:
                            _LOGGER.debug("%s.play_media legacy format failed: %s", s_domain, leg_err)

        # 4. Standard Home Assistant `media_player.play_media`
        if play_target:
            try:
                await self.hass.services.async_call(
                    "media_player",
                    "play_media",
                    service_data={
                        "media_content_id": play_target,
                        "media_content_type": "music",
                    },
                    target={"entity_id": player_entity_id},
                    blocking=False,
                )
                _LOGGER.info("Called media_player.play_media for %s with %s", player_entity_id, play_target)
                _schedule_seek()
                return True
            except Exception as err:
                _LOGGER.debug("media_player.play_media failed: %s, trying without target wrapper", err)
                try:
                    await self.hass.services.async_call(
                        "media_player",
                        "play_media",
                        service_data={
                            "entity_id": player_entity_id,
                            "media_content_id": play_target,
                            "media_content_type": "music",
                        },
                        blocking=False,
                    )
                    _schedule_seek()
                    return True
                except Exception:
                    pass

        # 5. Last fallback: media_player.media_play (resume current playback)
        try:
            await self.hass.services.async_call(
                "media_player",
                "media_play",
                target={"entity_id": player_entity_id},
                blocking=False,
            )
            _LOGGER.info("Called media_player.media_play for %s", player_entity_id)
            _schedule_seek()
            return True
        except Exception as err:
            _LOGGER.error("Failed to start playback on %s: %s", player_entity_id, err)
            return False

    async def async_stop_media(self, player_entity_id: str) -> bool:
        """Stop playback on player."""
        client = self._get_mass_client()
        clean_id = player_entity_id.replace("media_player.mass_", "").replace("media_player.", "")
        if client and hasattr(client, "player_queues") and hasattr(client.player_queues, "stop"):
            try:
                await client.player_queues.stop(clean_id)
                return True
            except Exception:
                pass

        for s_domain in ("music_assistant", "mass"):
            if self.hass.services.has_service(s_domain, "stop"):
                try:
                    await self.hass.services.async_call(
                        s_domain,
                        "stop",
                        target={"entity_id": player_entity_id},
                        blocking=False,
                    )
                    return True
                except Exception:
                    pass

        try:
            await self.hass.services.async_call(
                "media_player",
                "media_stop",
                target={"entity_id": player_entity_id},
                blocking=False,
            )
            return True
        except Exception as err:
            _LOGGER.warning("Failed to stop media on %s: %s", player_entity_id, err)
            return False

    async def async_pause_media(self, player_entity_id: str) -> bool:
        """Pause playback on player."""
        client = self._get_mass_client()
        clean_id = player_entity_id.replace("media_player.mass_", "").replace("media_player.", "")
        if client and hasattr(client, "player_queues") and hasattr(client.player_queues, "pause"):
            try:
                await client.player_queues.pause(clean_id)
                return True
            except Exception:
                pass

        for s_domain in ("music_assistant", "mass"):
            if self.hass.services.has_service(s_domain, "pause"):
                try:
                    await self.hass.services.async_call(
                        s_domain,
                        "pause",
                        target={"entity_id": player_entity_id},
                        blocking=False,
                    )
                    return True
                except Exception:
                    pass

        try:
            await self.hass.services.async_call(
                "media_player",
                "media_pause",
                target={"entity_id": player_entity_id},
                blocking=False,
            )
            return True
        except Exception as err:
            _LOGGER.warning("Failed to pause media on %s: %s", player_entity_id, err)
            return False

    async def async_seek_media(self, player_entity_id: str, position: float) -> bool:
        """Seek media player or Music Assistant queue to specific position in seconds."""
        if not player_entity_id:
            return False

        clean_id = player_entity_id.replace("media_player.mass_", "").replace("media_player.", "")
        client = self._get_mass_client()

        # 1. Direct Music Assistant client call
        if client and hasattr(client, "player_queues"):
            try:
                q_ctrl = client.player_queues
                if hasattr(q_ctrl, "seek"):
                    await q_ctrl.seek(clean_id, int(position))
                    _LOGGER.info("Direct client.player_queues.seek succeeded for %s at %.1fs", clean_id, position)
                    return True
                elif hasattr(q_ctrl, "seek_media"):
                    await q_ctrl.seek_media(clean_id, int(position))
                    return True
            except Exception as client_err:
                _LOGGER.debug("Direct client seek failed: %s", client_err)

        # 2. HA music_assistant / mass service
        for s_domain in ("music_assistant", "mass"):
            if self.hass.services.has_service(s_domain, "seek"):
                try:
                    await self.hass.services.async_call(
                        s_domain,
                        "seek",
                        service_data={"position": int(position)},
                        target={"entity_id": player_entity_id},
                        blocking=False,
                    )
                    return True
                except Exception:
                    pass

        # 3. Standard HA media_player.media_seek
        try:
            await self.hass.services.async_call(
                "media_player",
                "media_seek",
                service_data={
                    "entity_id": player_entity_id,
                    "seek_position": float(position),
                },
                blocking=False,
            )
            _LOGGER.info("Called media_player.media_seek for %s to %.1fs", player_entity_id, position)
            return True
        except Exception as err:
            _LOGGER.warning("Failed to seek on %s: %s", player_entity_id, err)
            return False

    def get_active_tracks(self) -> List[Dict[str, Any]]:
        """Return tracks currently playing, paused or recently active on any media player or Music Assistant queue."""
        active = []
        seen_ids = set()

        # 0. Entity registry lookup for MASS platform entities
        mass_entity_ids = set()
        try:
            from homeassistant.helpers import entity_registry as er
            ent_reg = er.async_get(self.hass)
            for entity_id, reg_entry in ent_reg.entities.items():
                if reg_entry.domain == "media_player" and reg_entry.platform in ("mass", "music_assistant"):
                    mass_entity_ids.add(entity_id)
        except Exception:
            pass

        # 1. Native Music Assistant server queues (finds local player, web player, soundcard, sendspin, etc.)
        for q in self.get_mass_server_queues():
            seen_ids.add(q["player_entity_id"])
            seen_ids.add(q["player_name"].lower())
            active.append(q)

        # 2. Home Assistant media_player states
        for state in self.hass.states.async_all("media_player"):
            attrs = state.attributes
            title = attrs.get("media_title")
            friendly_name = attrs.get("friendly_name", state.entity_id)

            is_mass = False
            if state.entity_id in mass_entity_ids:
                is_mass = True
            elif "mass_player_type" in attrs or "mass_player_id" in attrs:
                is_mass = True
            elif attrs.get("app_name") == "Music Assistant":
                is_mass = True
            elif "music_assistant" in str(state.context).lower():
                is_mass = True
            elif "mass" in state.entity_id.lower():
                is_mass = True

            if state.entity_id in seen_ids or friendly_name.lower() in seen_ids:
                continue

            duration = attrs.get("media_duration")
            media_content_id = attrs.get("media_content_id")
            if not media_content_id:
                media_content_id = f"media-source://mass/player/{state.entity_id}"

            seen_ids.add(state.entity_id)
            seen_ids.add(friendly_name.lower())

            provider_label = "HA Player"
            if is_mass:
                provider_label = "Music Assistant"
            p_check = (state.entity_id + " " + (media_content_id or "") + " " + (friendly_name or "")).lower()
            if "plex" in p_check:
                provider_label = "Plex"
            elif "jellyfin" in p_check:
                provider_label = "Jellyfin"
            elif any(x in p_check for x in ("subsonic", "opensubsonic", "navidrome", "gonic", "airsonic")):
                provider_label = "Subsonic / Navidrome"
            elif any(x in p_check for x in ("filesystem", "file", "smb", "nfs", "webdav", "local")):
                provider_label = "Lokale Datei (SMB/Disk)"
            elif "emby" in p_check:
                provider_label = "Emby"

            if title:
                active.append({
                    "player_entity_id": state.entity_id,
                    "player_name": friendly_name,
                    "state": state.state,
                    "title": title,
                    "artist": attrs.get("media_artist", ""),
                    "album": attrs.get("media_album_name", ""),
                    "duration": float(duration) if duration else 0.0,
                    "media_content_id": media_content_id,
                    "image": attrs.get("entity_picture"),
                    "has_track": True,
                    "is_mass": is_mass,
                    "provider_label": provider_label,
                })
            else:
                # Include all players so the user can always see and select their local or desired player!
                active.append({
                    "player_entity_id": state.entity_id,
                    "player_name": friendly_name,
                    "state": state.state,
                    "title": "Bereit",
                    "artist": "",
                    "album": "",
                    "duration": 0.0,
                    "media_content_id": media_content_id,
                    "image": None,
                    "has_track": False,
                    "is_mass": is_mass,
                    "provider_label": provider_label,
                })

        # Sort priority: has_track first, then playing > paused > idle > other, and is_mass first
        state_priority = {"playing": 0, "paused": 1, "idle": 2, "standby": 3}
        active.sort(key=lambda x: (
            not x.get("has_track", False),
            state_priority.get(x["state"], 4),
            not x["is_mass"],
            x["player_name"].lower()
        ))
        return active

    async def async_search(self, query: str, limit: int = 25) -> List[Dict[str, Any]]:
        """Direct native search using Music Assistant action or active players."""
        results = []
        if not query or not query.strip():
            return results

        q = query.strip()

        # 1. Native search action in Home Assistant (supports mass and music_assistant domains)
        search_domains = [d for d in ("mass", "music_assistant") if self.hass.services.has_service(d, "search")]
        for s_domain in search_domains:
            for media_type_param in (["track"], "track"):
                try:
                    res = await self.hass.services.async_call(
                        domain=s_domain,
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
                                _LOGGER.info("%s.search successfully returned %d tracks for '%s'", s_domain, len(results), q)
                                return results
                except Exception as err:
                    _LOGGER.debug("%s.search attempt failed with param %s: %s", s_domain, media_type_param, err)

        # 1b. Direct Music Assistant client search
        client = self._get_mass_client()
        if not results and client and hasattr(client, "music") and hasattr(client.music, "search"):
            try:
                search_res = await client.music.search(search_query=q, media_types=["track"], limit=limit)
                tracks = getattr(search_res, "tracks", []) if search_res else []
                for item in tracks:
                    artists = getattr(item, "artists", [])
                    if isinstance(artists, list):
                        artist_name = ", ".join(getattr(a, "name", str(a)) for a in artists)
                    else:
                        artist_name = str(artists)
                    album_obj = getattr(item, "album", None)
                    album_name = getattr(album_obj, "name", str(album_obj)) if album_obj else ""
                    uri = getattr(item, "uri", "") or f"media-source://mass/track/{getattr(item, 'item_id', '')}"
                    duration = getattr(item, "duration", 0)
                    image = getattr(item, "image", None)
                    results.append({
                        "title": getattr(item, "name", "Unbekannter Titel"),
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
                    _LOGGER.info("client.music.search successfully returned %d tracks for '%s'", len(results), q)
                    return results
            except Exception as err:
                _LOGGER.debug("client.music.search error: %s", err)

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
        """Resolve any media identifier or music source to a playable/streamable audio URL.

        Supports all local and self-hosted Music Assistant sources:
        - Local Filesystem & Direct disk files (/media, /share, /config/www, file://)
        - Network Shares (SMB / CIFS, NFS, WebDAV)
        - Plex Media Server
        - Jellyfin Media Server
        - Subsonic / OpenSubsonic (Navidrome, Gonic, Airsonic)
        - Emby Media Server
        - DLNA / UPnP Media Servers
        - Music Assistant Unified Library & Queue Flow Stream
        """
        if not media_content_id:
            return None

        # 1. Direct HTTP/HTTPS URL
        if media_content_id.startswith(("http://", "https://")):
            return {
                "url": media_content_id,
                "mime_type": "audio/mpeg",
                "duration": 0.0,
            }

        # 2. Local LightShow upload
        if media_content_id.startswith("/api/lightshow/audio/"):
            return {
                "url": media_content_id,
                "mime_type": "audio/mpeg",
                "duration": 0.0,
            }

        # 3. Direct local file on disk or file:// URI
        raw_disk_path = media_content_id
        if raw_disk_path.startswith("file://"):
            raw_disk_path = unquote(raw_disk_path[7:])
        if os.path.isfile(raw_disk_path):
            import mimetypes
            content_type, _ = mimetypes.guess_type(raw_disk_path)
            return {
                "url": f"/api/lightshow/media/proxy?file={quote(raw_disk_path)}",
                "mime_type": content_type or "audio/mpeg",
                "duration": 0.0,
            }

        # 4. Check active player / queue references
        target_track = None
        for a in self.get_active_tracks():
            if (
                media_content_id in (a.get("media_content_id"), a.get("player_entity_id"), a.get("queue_id"))
                or f"media-source://mass/player/{a.get('queue_id')}" == media_content_id
                or f"media-source://mass/player/{a.get('player_entity_id')}" == media_content_id
            ):
                target_track = a
                break

        track_duration = float(target_track.get("duration", 0.0)) if target_track else 0.0

        # Check if target track already knows a local file path
        if target_track and target_track.get("file_path"):
            f_path = target_track["file_path"]
            if os.path.isfile(f_path):
                import mimetypes
                c_type, _ = mimetypes.guess_type(f_path)
                return {
                    "url": f"/api/lightshow/media/proxy?file={quote(f_path)}",
                    "mime_type": c_type or "audio/mpeg",
                    "duration": track_duration,
                }

        # Check provider_mappings on target_track for direct URLs or files
        if target_track and target_track.get("provider_mappings"):
            for m in target_track["provider_mappings"]:
                m_url = m.get("url")
                if m_url and m_url.startswith(("http://", "https://")):
                    return {
                        "url": m_url,
                        "mime_type": "audio/mpeg",
                        "duration": track_duration,
                    }
                m_file = m.get("item_id")
                if m_file and os.path.isfile(m_file):
                    import mimetypes
                    c_type, _ = mimetypes.guess_type(m_file)
                    return {
                        "url": f"/api/lightshow/media/proxy?file={quote(m_file)}",
                        "mime_type": c_type or "audio/mpeg",
                        "duration": track_duration,
                    }

        # If active track has inner ID, attempt recursion
        if target_track and target_track.get("media_content_id") and target_track["media_content_id"] != media_content_id:
            inner_id = target_track["media_content_id"]
            if not inner_id.startswith("media-source://mass/player/"):
                resolved_inner = await self.async_resolve_media(inner_id)
                if resolved_inner and resolved_inner.get("url"):
                    if not resolved_inner.get("duration") and track_duration:
                        resolved_inner["duration"] = track_duration
                    return resolved_inner

        # Determine target player entity for resolution
        target_player = None
        if target_track and target_track.get("player_entity_id"):
            target_player = target_track["player_entity_id"]
        elif self.get_players():
            target_player = self.get_players()[0].get("entity_id")

        # 5. Check if player entity state currently has a direct playable URL
        if target_player:
            player_state = self.hass.states.get(target_player)
            if player_state and player_state.attributes:
                p_url = player_state.attributes.get("media_content_id")
                if p_url and str(p_url).startswith(("http://", "https://")):
                    return {
                        "url": p_url,
                        "mime_type": "audio/mpeg",
                        "duration": track_duration,
                    }

        # 6. Normalize URI scheme and extract clean ID / path across all local providers
        clean_id = str(media_content_id)
        provider_hint = "mass"
        for prefix in (
            "plex://track/", "plex://",
            "jellyfin://track/", "jellyfin://item/", "jellyfin://",
            "emby://track/", "emby://item/", "emby://",
            "subsonic://track/", "subsonic://",
            "opensubsonic://track/", "opensubsonic://",
            "navidrome://track/", "navidrome://",
            "filesystem://track/", "filesystem://",
            "file://",
            "smb://", "nfs://", "webdav://",
            "media-source://mass/track/", "media-source://mass/",
            "media-source://plex/track/", "media-source://plex/",
            "media-source://jellyfin/track/", "media-source://jellyfin/",
            "media-source://subsonic/track/", "media-source://subsonic/",
            "media-source://opensubsonic/track/", "media-source://opensubsonic/",
            "media-source://emby/track/", "media-source://emby/",
            "media-source://media_source/local/", "media-source://media_source/",
            "media-source://",
            "library://track/", "library://",
            "/",
        ):
            if clean_id.startswith(prefix):
                if "plex" in prefix:
                    provider_hint = "plex"
                elif "jellyfin" in prefix:
                    provider_hint = "jellyfin"
                elif any(x in prefix for x in ("subsonic", "opensubsonic", "navidrome")):
                    provider_hint = "subsonic"
                elif "emby" in prefix:
                    provider_hint = "emby"
                elif any(x in prefix for x in ("filesystem", "file", "smb", "nfs", "webdav", "local")):
                    provider_hint = "filesystem"
                clean_id = clean_id[len(prefix):]
                break

        # Check standard HA file storage directories for filesystem / network share items
        candidate_paths = [
            clean_id,
            f"/media/{clean_id}",
            f"/share/{clean_id}",
            f"/config/www/{clean_id}",
            f"/media/music/{clean_id}",
            f"/share/music/{clean_id}",
        ]
        for p in candidate_paths:
            if os.path.isfile(p):
                import mimetypes
                c_type, _ = mimetypes.guess_type(p)
                return {
                    "url": f"/api/lightshow/media/proxy?file={quote(p)}",
                    "mime_type": c_type or "audio/mpeg",
                    "duration": track_duration,
                }

        # 7. Try Home Assistant media_source resolution with multi-provider candidates
        try:
            from homeassistant.components import media_source
            from homeassistant.components.media_player import async_process_play_media_url

            candidates = [media_content_id]
            last_part = clean_id.split("/")[-1] if "/" in clean_id else clean_id

            # Provider-specific priority candidates
            if provider_hint == "plex":
                candidates.extend([
                    f"media-source://plex/{clean_id}",
                    f"media-source://plex/track/{clean_id}",
                    f"media-source://mass/{clean_id}",
                    f"media-source://mass/track/{clean_id}",
                    f"media-source://plex/{last_part}",
                ])
            elif provider_hint == "jellyfin":
                candidates.extend([
                    f"media-source://jellyfin/{clean_id}",
                    f"media-source://jellyfin/track/{clean_id}",
                    f"media-source://mass/{clean_id}",
                    f"media-source://mass/track/{clean_id}",
                    f"media-source://jellyfin/{last_part}",
                ])
            elif provider_hint == "subsonic":
                candidates.extend([
                    f"media-source://subsonic/{clean_id}",
                    f"media-source://opensubsonic/{clean_id}",
                    f"media-source://mass/{clean_id}",
                    f"media-source://mass/track/{clean_id}",
                    f"media-source://subsonic/{last_part}",
                ])
            elif provider_hint == "emby":
                candidates.extend([
                    f"media-source://emby/{clean_id}",
                    f"media-source://mass/{clean_id}",
                    f"media-source://mass/track/{clean_id}",
                ])
            elif provider_hint == "filesystem":
                candidates.extend([
                    f"media-source://media_source/local/{clean_id}",
                    f"media-source://media_source/local/{last_part}",
                    f"media-source://filesystem/{clean_id}",
                    f"media-source://mass/{clean_id}",
                    f"media-source://mass/track/{clean_id}",
                ])
            else:
                candidates.extend([
                    f"media-source://mass/{clean_id}",
                    f"media-source://mass/track/{clean_id}",
                    f"media-source://media_source/local/{clean_id}",
                    f"media-source://plex/{clean_id}",
                    f"media-source://jellyfin/{clean_id}",
                    f"media-source://subsonic/{clean_id}",
                ])

            if "/" in clean_id:
                candidates.append(f"media-source://mass/track/{last_part}")
                candidates.append(f"media-source://plex/{last_part}")
                candidates.append(f"media-source://jellyfin/{last_part}")
                candidates.append(f"media-source://subsonic/{last_part}")
                candidates.append(f"media-source://media_source/local/{last_part}")

            for cand in candidates:
                for p_target in (target_player, None):
                    try:
                        resolved = await media_source.async_resolve_media(
                            self.hass,
                            cand,
                            p_target,
                        )
                        if resolved and resolved.url:
                            try:
                                final_url = async_process_play_media_url(self.hass, resolved.url)
                            except Exception:
                                final_url = resolved.url

                            return {
                                "url": final_url,
                                "mime_type": getattr(resolved, "mime_type", "audio/mpeg"),
                                "duration": track_duration,
                            }
                    except Exception as direct_err:
                        _LOGGER.debug("Resolve %s with player %s failed: %s", cand, p_target, direct_err)

        except Exception as err:
            _LOGGER.debug("media_source resolution error for %s: %s", media_content_id, err)

        # 8. Check direct Home Assistant native Plex integration
        try:
            if "plex" in self.hass.data:
                plex_data = self.hass.data["plex"]
                servers = []
                if isinstance(plex_data, dict):
                    for v in plex_data.values():
                        if hasattr(v, "url") or hasattr(v, "_server"):
                            servers.append(v)
                for s in servers:
                    part_id = clean_id.split("/")[-1]
                    if part_id.isdigit():
                        plex_url = s.url(f"/library/parts/{part_id}/file.mp3", include_token=True)
                        if plex_url:
                            return {
                                "url": plex_url,
                                "mime_type": "audio/mpeg",
                                "duration": track_duration,
                            }
        except Exception as plex_err:
            _LOGGER.debug("Direct Plex resolution error: %s", plex_err)

        # 9. Check direct Home Assistant native Jellyfin integration
        try:
            if "jellyfin" in self.hass.data:
                jf_data = self.hass.data["jellyfin"]
                if isinstance(jf_data, dict):
                    for jf_entry in jf_data.values():
                        jf_client = getattr(jf_entry, "client", jf_entry)
                        host = getattr(jf_client, "host", "") or getattr(jf_client, "server_url", "")
                        token = getattr(jf_client, "token", "") or getattr(jf_client, "api_key", "")
                        item_id = clean_id.split("/")[-1]
                        if host and token and item_id:
                            jf_url = f"{host.rstrip('/')}/Audio/{item_id}/stream?static=true&api_key={token}"
                            return {
                                "url": jf_url,
                                "mime_type": "audio/mpeg",
                                "duration": track_duration,
                            }
        except Exception as jf_err:
            _LOGGER.debug("Direct Jellyfin resolution error: %s", jf_err)

        # 10. Check Music Assistant client direct server flow (Queue Flow Mode)
        server_url = self._get_mass_server_url()
        if server_url:
            queue_id = target_track.get("queue_id") if target_track else None
            if not queue_id and "/player/" in media_content_id:
                queue_id = media_content_id.split("/player/")[-1]
            if not queue_id and target_player:
                queue_id = target_player

            # If still no queue_id, check all queues in client.player_queues
            client = self._get_mass_client()
            if not queue_id and client and hasattr(client, "player_queues"):
                q_ctrl = client.player_queues
                try:
                    all_q = list(q_ctrl.all()) if hasattr(q_ctrl, "all") and callable(q_ctrl.all) else (
                        list(q_ctrl.queues.values()) if hasattr(q_ctrl, "queues") and isinstance(q_ctrl.queues, dict) else []
                    )
                    if all_q:
                        queue_id = getattr(all_q[0], "queue_id", None) or getattr(all_q[0], "player_id", None)
                except Exception:
                    pass

            if queue_id:
                clean_qid = str(queue_id).replace("media_player.mass_", "").replace("media_player.", "")
                return {
                    "url": f"{server_url}/flow/{clean_qid}",
                    "mime_type": "audio/flac",
                    "duration": track_duration,
                }

        # 11. Return graceful fallback with duration
        return {
            "url": None,
            "mime_type": "audio/mpeg",
            "duration": track_duration,
        }

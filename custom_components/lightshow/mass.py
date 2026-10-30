"""Music Assistant integration helper."""

import logging
from typing import Dict, List, Optional, Any
from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)


class MusicAssistantHelper:
    """Helper to communicate with Music Assistant and Home Assistant media players."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass

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

    def get_mass_server_queues(self) -> List[Dict[str, Any]]:
        """Retrieve all active queues from Music Assistant client."""
        client = self._get_mass_client()
        if not client:
            return []

        queues_data = []
        try:
            queues_controller = getattr(client, "player_queues", None)
            if not queues_controller:
                return []

            raw_queues = []
            if hasattr(queues_controller, "all"):
                all_attr = getattr(queues_controller, "all")
                if not callable(all_attr):
                    raw_queues = list(all_attr.values()) if isinstance(all_attr, dict) else list(all_attr)
            elif hasattr(queues_controller, "queues"):
                q_attr = getattr(queues_controller, "queues")
                raw_queues = list(q_attr.values()) if isinstance(q_attr, dict) else list(q_attr)
            elif isinstance(queues_controller, (dict, list)):
                raw_queues = list(queues_controller.values()) if isinstance(queues_controller, dict) else list(queues_controller)
            else:
                try:
                    raw_queues = list(queues_controller)
                except Exception:
                    pass

            for q in raw_queues:
                queue_id = getattr(q, "queue_id", None) or getattr(q, "player_id", "")
                display_name = getattr(q, "display_name", "") or getattr(q, "name", str(queue_id))
                current_item = getattr(q, "current_item", None)
                state = str(getattr(q, "state", "idle")).lower()

                title = ""
                artist = ""
                album = ""
                duration = 0.0
                uri = ""
                image = None

                if current_item:
                    title = getattr(current_item, "name", "")
                    artists = getattr(current_item, "artists", [])
                    if isinstance(artists, list):
                        artist = ", ".join(getattr(a, "name", str(a)) for a in artists)
                    else:
                        artist = str(artists)

                    album_obj = getattr(current_item, "album", None)
                    if album_obj:
                        album = getattr(album_obj, "name", str(album_obj))

                    duration = float(getattr(current_item, "duration", 0) or 0)
                    uri = getattr(current_item, "uri", "")
                    image = getattr(current_item, "image", None)

                queues_data.append({
                    "queue_id": queue_id,
                    "player_entity_id": f"media_player.{queue_id}" if not str(queue_id).startswith("media_player.") else queue_id,
                    "player_name": display_name or f"Music Assistant ({queue_id})",
                    "state": state,
                    "title": title or "Bereit (Music Assistant)",
                    "artist": artist,
                    "album": album,
                    "duration": duration,
                    "media_content_id": uri or f"media-source://mass/player/{queue_id}",
                    "image": image,
                    "has_track": bool(title),
                    "is_mass": True,
                })
        except Exception as err:
            _LOGGER.debug("Error inspecting Music Assistant server queues: %s", err)

        return queues_data

    def get_players(self) -> List[Dict[str, Any]]:
        """Return all available media_player entities, prioritizing Music Assistant players."""
        players = []
        seen = set()

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
            if "mass_player_type" in attrs or "mass_player_id" in attrs:
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
        """Return tracks currently playing, paused or recently active on any media player or Music Assistant queue."""
        active = []
        seen_ids = set()

        # 1. Native Music Assistant server queues (finds local player, web player, soundcard, etc.)
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
            if "mass_player_type" in attrs or "mass_player_id" in attrs:
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

            if title:
                seen_ids.add(state.entity_id)
                seen_ids.add(friendly_name.lower())
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
                })
            elif is_mass or "device" in state.entity_id.lower() or "local" in state.entity_id.lower() or "chrome" in state.entity_id.lower():
                # Always include Music Assistant and local player entities so user can select them!
                seen_ids.add(state.entity_id)
                seen_ids.add(friendly_name.lower())
                active.append({
                    "player_entity_id": state.entity_id,
                    "player_name": friendly_name,
                    "state": state.state,
                    "title": "Bereit (Music Assistant Player)",
                    "artist": "",
                    "album": "",
                    "duration": 0.0,
                    "media_content_id": media_content_id,
                    "image": None,
                    "has_track": False,
                    "is_mass": True,
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

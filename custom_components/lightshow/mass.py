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
                title = ""
                artist = ""
                album = ""
                duration = 0.0
                uri = ""
                image = None

                if cur_media:
                    title = getattr(cur_media, "title", "") or getattr(cur_media, "name", "")
                    artist = getattr(cur_media, "artist", "")
                    album = getattr(cur_media, "album", "")
                    duration = float(getattr(cur_media, "duration", 0) or 0)
                    uri = getattr(cur_media, "uri", "")
                    m_item = getattr(cur_media, "media_item", None)
                    if not uri and m_item:
                        uri = getattr(m_item, "uri", "") or getattr(m_item, "item_id", "")
                    if not uri:
                        item_id = getattr(cur_media, "item_id", None)
                        if item_id:
                            uri = f"media-source://mass/track/{item_id}"
                    image = getattr(cur_media, "image_url", None) or getattr(cur_media, "image", None)

                # Check player_queues for active item if not on player directly
                if not title and hasattr(client, "player_queues"):
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
                        c_item = q.current_item
                        title = getattr(c_item, "name", "") or getattr(c_item, "title", "")
                        artists = getattr(c_item, "artists", [])
                        if isinstance(artists, list):
                            artist = ", ".join(getattr(a, "name", str(a)) for a in artists)
                        else:
                            artist = str(artists)
                        album_obj = getattr(c_item, "album", None)
                        if album_obj:
                            album = getattr(album_obj, "name", str(album_obj))
                        duration = float(getattr(c_item, "duration", 0) or 0)
                        uri = getattr(c_item, "uri", "")
                        m_item = getattr(c_item, "media_item", None)
                        if not uri and m_item:
                            uri = getattr(m_item, "uri", "") or getattr(m_item, "item_id", "")
                        if not uri:
                            item_id = getattr(c_item, "item_id", None)
                            if item_id:
                                uri = f"media-source://mass/track/{item_id}"
                        image = getattr(c_item, "image", None)

                seen_ids.add(p_id)
                seen_ids.add(display_name.lower())
                entity_id = f"media_player.mass_{p_id}" if not str(p_id).startswith("media_player.") else p_id

                results.append({
                    "queue_id": p_id,
                    "player_entity_id": entity_id,
                    "player_name": display_name,
                    "state": state,
                    "title": title or "Bereit (Music Assistant)",
                    "artist": artist,
                    "album": album,
                    "duration": duration,
                    "media_content_id": uri or f"media-source://mass/player/{p_id}",
                    "image": image,
                    "has_track": bool(title),
                    "is_mass": True,
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

                title = ""
                artist = ""
                album = ""
                duration = 0.0
                uri = ""
                image = None

                if current_item:
                    title = getattr(current_item, "name", "") or getattr(current_item, "title", "")
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
                    m_item = getattr(current_item, "media_item", None)
                    if not uri and m_item:
                        uri = getattr(m_item, "uri", "") or getattr(m_item, "item_id", "")
                    if not uri:
                        item_id = getattr(current_item, "item_id", None)
                        if item_id:
                            uri = f"media-source://mass/track/{item_id}"
                    image = getattr(current_item, "image", None)

                entity_id = f"media_player.mass_{queue_id}" if not str(queue_id).startswith("media_player.") else queue_id
                results.append({
                    "queue_id": queue_id,
                    "player_entity_id": entity_id,
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
    ) -> bool:
        """Start media playback on the specified player via Music Assistant or Home Assistant."""
        if not player_entity_id:
            _LOGGER.warning("async_play_media called without player_entity_id")
            return False

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
            "async_play_media on %s with target: %s (original media_id: %s, title: %s)",
            player_entity_id,
            play_target,
            media_id,
            track_title,
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
                    return True
                else:
                    if hasattr(client.player_queues, "resume"):
                        await client.player_queues.resume(queue_id)
                        _LOGGER.info("Direct client.player_queues.resume succeeded for queue '%s'", queue_id)
                        return True
                    elif hasattr(client.player_queues, "play"):
                        await client.player_queues.play(queue_id)
                        _LOGGER.info("Direct client.player_queues.play succeeded for queue '%s'", queue_id)
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
        """Resolve media identifier to a playable/streamable audio URL."""
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

        # 3. Check if this is a player reference (e.g. media-source://mass/player/{id} or media_player.xxx)
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

        if target_track and target_track.get("media_content_id") and target_track["media_content_id"] != media_content_id:
            inner_id = target_track["media_content_id"]
            if not inner_id.startswith("media-source://mass/player/"):
                resolved_inner = await self.async_resolve_media(inner_id)
                if resolved_inner:
                    if not resolved_inner.get("duration") and track_duration:
                        resolved_inner["duration"] = track_duration
                    return resolved_inner

        # Determine target player entity for resolution
        target_player = None
        if target_track and target_track.get("player_entity_id"):
            target_player = target_track["player_entity_id"]
        elif self.get_players():
            target_player = self.get_players()[0].get("entity_id")

        # 4. Try Home Assistant media_source resolution with signed play media URL
        try:
            from homeassistant.components import media_source
            from homeassistant.components.media_player import async_process_play_media_url

            candidates = [media_content_id]
            if not media_content_id.startswith("media-source://"):
                clean_id = media_content_id.lstrip("/")
                candidates.extend([
                    f"media-source://mass/{clean_id}",
                    f"media-source://media_source/local/{clean_id}",
                ])

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

        # 5. Check Music Assistant client direct server flow
        client = self._get_mass_client()
        if client:
            server_url = getattr(client, "server_url", None)
            if server_url:
                queue_id = target_track.get("queue_id") if target_track else None
                if not queue_id and "/player/" in media_content_id:
                    queue_id = media_content_id.split("/player/")[-1]

                if queue_id:
                    clean_qid = queue_id.replace("media_player.mass_", "").replace("media_player.", "")
                    return {
                        "url": f"{server_url}/flow/{clean_qid}",
                        "mime_type": "audio/flac",
                        "duration": track_duration,
                    }

        # 6. Return graceful fallback with duration
        return {
            "url": None,
            "mime_type": "audio/mpeg",
            "duration": track_duration,
        }

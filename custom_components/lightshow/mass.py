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
            resolved = await media_source.async_resolve_media(
                self.hass,
                media_content_id,
                None,
            )
            return {
                "url": resolved.url,
                "mime_type": resolved.mime_type,
            }
        except Exception as err:
            _LOGGER.error("Failed to resolve media %s: %s", media_content_id, err)
            return None

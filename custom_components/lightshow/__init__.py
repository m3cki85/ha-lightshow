"""LightShow Studio for Home Assistant."""

import logging
from homeassistant.config_entries import ConfigEntry, SOURCE_IMPORT
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers.typing import ConfigType
from homeassistant.components import frontend, panel_custom

from .const import (
    DOMAIN,
    DATA_ENGINE,
    DATA_STORAGE,
    SERVICE_PLAY,
    SERVICE_STOP,
    SERVICE_PAUSE,
    SERVICE_RESUME,
    CONF_SHOW_ID,
    CONF_PLAYER_ENTITY_ID,
    CONF_LOOP,
)
from .storage import LightShowStorage
from .mass import MusicAssistantHelper
from .engine import LightShowEngine
from .api import register_api_views

_LOGGER = logging.getLogger(__name__)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up via configuration.yaml (if used)."""
    hass.data.setdefault(DOMAIN, {})

    if DOMAIN in config:
        hass.async_create_task(
            hass.config_entries.flow.async_init(
                DOMAIN, context={"source": SOURCE_IMPORT}
            )
        )

    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up LightShow Studio from a config entry."""
    hass.data.setdefault(DOMAIN, {})

    storage = LightShowStorage(hass)
    mass_helper = MusicAssistantHelper(hass)
    engine = LightShowEngine(hass, storage, mass_helper)

    hass.data[DOMAIN] = {
        DATA_STORAGE: storage,
        DATA_ENGINE: engine,
        "mass": mass_helper,
    }

    # Register HTTP and REST endpoints
    register_api_views(hass, storage, engine, mass_helper)

    # Register Sidebar Panel via official panel_custom
    try:
        await panel_custom.async_register_panel(
            hass=hass,
            webcomponent_name="lightshow-panel",
            frontend_url_path="lightshow",
            sidebar_title="LightShow",
            sidebar_icon="mdi:creation",
            module_url="/api/lightshow/frontend/panel.js",
            config={},
            require_admin=False,
        )
        _LOGGER.info("Successfully registered LightShow Studio panel in Home Assistant sidebar")
    except Exception as err:
        _LOGGER.error("Failed to register LightShow Studio sidebar panel: %s", err)

    # Register Services
    async def handle_play(call: ServiceCall) -> None:
        show_id = call.data.get(CONF_SHOW_ID)
        player_entity_id = call.data.get(CONF_PLAYER_ENTITY_ID)
        loop = call.data.get(CONF_LOOP)
        if show_id:
            await engine.async_play(
                show_id=show_id,
                player_entity_id=player_entity_id,
                loop=loop,
            )
        else:
            _LOGGER.error("Service play called without show_id")

    async def handle_stop(call: ServiceCall) -> None:
        await engine.async_stop()

    async def handle_pause(call: ServiceCall) -> None:
        await engine.async_pause()

    async def handle_resume(call: ServiceCall) -> None:
        await engine.async_resume()

    hass.services.async_register(DOMAIN, SERVICE_PLAY, handle_play)
    hass.services.async_register(DOMAIN, SERVICE_STOP, handle_stop)
    hass.services.async_register(DOMAIN, SERVICE_PAUSE, handle_pause)
    hass.services.async_register(DOMAIN, SERVICE_RESUME, handle_resume)

    _LOGGER.info("LightShow Studio successfully initialized and ready")
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload LightShow Studio entry."""
    data = hass.data.get(DOMAIN, {})
    engine: LightShowEngine = data.get(DATA_ENGINE)
    if engine:
        await engine.async_stop()

    try:
        frontend.async_remove_panel(hass, "lightshow")
    except Exception:
        pass

    hass.services.async_remove(DOMAIN, SERVICE_PLAY)
    hass.services.async_remove(DOMAIN, SERVICE_STOP)
    hass.services.async_remove(DOMAIN, SERVICE_PAUSE)
    hass.services.async_remove(DOMAIN, SERVICE_RESUME)

    hass.data.pop(DOMAIN, None)
    return True

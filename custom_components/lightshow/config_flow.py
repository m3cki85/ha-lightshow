"""Config flow for LightShow Studio integration."""

import logging
from typing import Any, Dict, Optional
from homeassistant import config_entries
from homeassistant.core import callback

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)


class LightShowConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for LightShow Studio."""

    VERSION = 1

    async def async_step_user(
        self, user_input: Optional[Dict[str, Any]] = None
    ) -> config_entries.ConfigFlowResult:
        """Handle the initial step."""
        # Allow only a single entry
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()

        if user_input is not None:
            return self.async_create_entry(title="LightShow Studio", data={})

        return self.async_show_form(step_id="user")

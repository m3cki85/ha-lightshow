"""HTTP Views and REST API for LightShow Studio."""

import os
import mimetypes
import logging
from aiohttp import web
from homeassistant.core import HomeAssistant
from homeassistant.components.http import HomeAssistantView

from .const import API_URL_PREFIX, FRONTEND_URL
from .storage import LightShowStorage
from .engine import LightShowEngine
from .mass import MusicAssistantHelper

_LOGGER = logging.getLogger(__name__)


def register_api_views(
    hass: HomeAssistant,
    storage: LightShowStorage,
    engine: LightShowEngine,
    mass_helper: MusicAssistantHelper,
) -> None:
    """Register all API routes in Home Assistant."""
    hass.http.register_view(LightShowStatusView(engine))
    hass.http.register_view(LightShowShowsListView(storage))
    hass.http.register_view(LightShowShowDetailView(storage))
    hass.http.register_view(LightShowLightsView(hass))
    hass.http.register_view(LightShowPlayersView(mass_helper))
    hass.http.register_view(LightShowAudioUploadView(storage))
    hass.http.register_view(LightShowAudioListView(storage))
    hass.http.register_view(LightShowAudioStreamView(storage))
    hass.http.register_view(LightShowMediaBrowseView(mass_helper))
    hass.http.register_view(LightShowMediaResolveView(mass_helper))
    hass.http.register_view(LightShowControlView(engine))
    hass.http.register_view(LightShowFrontendView())


class LightShowBaseView(HomeAssistantView):
    """Base view with permissive auth for iframe studio."""
    requires_auth = False


class LightShowStatusView(LightShowBaseView):
    """Return engine status."""
    url = f"{API_URL_PREFIX}/status"
    name = "api:lightshow:status"

    def __init__(self, engine: LightShowEngine) -> None:
        self.engine = engine

    async def get(self, request: web.Request) -> web.Response:
        return self.json(self.engine.get_status())


class LightShowShowsListView(LightShowBaseView):
    """List or create shows."""
    url = f"{API_URL_PREFIX}/shows"
    name = "api:lightshow:shows"

    def __init__(self, storage: LightShowStorage) -> None:
        self.storage = storage

    async def get(self, request: web.Request) -> web.Response:
        shows = await self.storage.async_get_shows()
        return self.json({"shows": shows})

    async def post(self, request: web.Request) -> web.Response:
        try:
            data = await request.json()
            show_id = await self.storage.async_save_show(data)
            return self.json({"success": True, "id": show_id})
        except Exception as err:
            _LOGGER.error("Failed to save show: %s", err)
            return self.json({"success": False, "error": str(err)}, status_code=400)


class LightShowShowDetailView(LightShowBaseView):
    """Get or delete a specific show."""
    url = f"{API_URL_PREFIX}/shows/{{show_id}}"
    name = "api:lightshow:show_detail"

    def __init__(self, storage: LightShowStorage) -> None:
        self.storage = storage

    async def get(self, request: web.Request, show_id: str) -> web.Response:
        show = await self.storage.async_get_show(show_id)
        if not show:
            return self.json({"error": "Show not found"}, status_code=404)
        return self.json(show)

    async def delete(self, request: web.Request, show_id: str) -> web.Response:
        deleted = await self.storage.async_delete_show(show_id)
        return self.json({"success": deleted})


class LightShowLightsView(LightShowBaseView):
    """List all light entities and their capabilities."""
    url = f"{API_URL_PREFIX}/lights"
    name = "api:lightshow:lights"

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass

    async def get(self, request: web.Request) -> web.Response:
        lights = []
        for state in self.hass.states.async_all("light"):
            attrs = state.attributes
            entity_id = state.entity_id

            # Determine capabilities
            color_modes = attrs.get("supported_color_modes") or []
            effect_list = attrs.get("effect_list") or []

            # Check if it's WLED
            is_wled = (
                "wled" in entity_id.lower()
                or "wled" in str(attrs.get("friendly_name", "")).lower()
                or len(effect_list) > 10
            )

            lights.append({
                "entity_id": entity_id,
                "name": attrs.get("friendly_name", entity_id),
                "state": state.state,
                "color_modes": color_modes,
                "effect_list": effect_list,
                "is_wled": is_wled,
                "current_brightness": attrs.get("brightness"),
                "current_rgb": attrs.get("rgb_color"),
                "current_effect": attrs.get("effect"),
            })

        lights.sort(key=lambda l: l["name"].lower())
        return self.json({"lights": lights})


class LightShowPlayersView(LightShowBaseView):
    """List all media players."""
    url = f"{API_URL_PREFIX}/players"
    name = "api:lightshow:players"

    def __init__(self, mass_helper: MusicAssistantHelper) -> None:
        self.mass = mass_helper

    async def get(self, request: web.Request) -> web.Response:
        players = self.mass.get_players()
        return self.json({"players": players})


class LightShowAudioListView(LightShowBaseView):
    """List available audio files in storage."""
    url = f"{API_URL_PREFIX}/audio"
    name = "api:lightshow:audio_list"

    def __init__(self, storage: LightShowStorage) -> None:
        self.storage = storage

    async def get(self, request: web.Request) -> web.Response:
        files = await self.storage.async_list_audio_files()
        return self.json({"files": files})


class LightShowAudioUploadView(LightShowBaseView):
    """Upload an audio file (MP3, WAV, etc.) to the local audio store."""
    url = f"{API_URL_PREFIX}/audio/upload"
    name = "api:lightshow:audio_upload"

    def __init__(self, storage: LightShowStorage) -> None:
        self.storage = storage

    async def post(self, request: web.Request) -> web.Response:
        try:
            reader = await request.multipart()
            uploaded_filename = None

            while True:
                part = await reader.next()
                if part is None:
                    break
                if part.name == "file":
                    filename = os.path.basename(part.filename or "track.mp3")
                    # Sanitize filename
                    safe_name = "".join(c for c in filename if c.isalnum() or c in (".", "-", "_"))
                    filepath = os.path.join(self.storage.audio_dir, safe_name)
                    
                    with open(filepath, "wb") as f:
                        while True:
                            chunk = await part.read_chunk()
                            if not chunk:
                                break
                            f.write(chunk)
                    uploaded_filename = safe_name

            if uploaded_filename:
                return self.json({
                    "success": True,
                    "filename": uploaded_filename,
                    "url": f"/api/lightshow/audio/{uploaded_filename}",
                })
            return self.json({"success": False, "error": "No file uploaded"}, status_code=400)
        except Exception as err:
            _LOGGER.error("Audio upload failed: %s", err)
            return self.json({"success": False, "error": str(err)}, status_code=500)


class LightShowAudioStreamView(LightShowBaseView):
    """Serve audio files with range header support."""
    url = f"{API_URL_PREFIX}/audio/{{filename}}"
    name = "api:lightshow:audio_stream"

    def __init__(self, storage: LightShowStorage) -> None:
        self.storage = storage

    async def get(self, request: web.Request, filename: str) -> web.Response:
        filepath = self.storage.get_audio_file_path(filename)
        if not filepath or not os.path.isfile(filepath):
            return web.Response(status=404, text="Audio file not found")
        
        content_type, _ = mimetypes.guess_type(filepath)
        return web.FileResponse(filepath, headers={"Content-Type": content_type or "audio/mpeg"})


class LightShowControlView(LightShowBaseView):
    """Control engine playback and test cues live."""
    url = f"{API_URL_PREFIX}/control"
    name = "api:lightshow:control"

    def __init__(self, engine: LightShowEngine) -> None:
        self.engine = engine

    async def post(self, request: web.Request) -> web.Response:
        try:
            data = await request.json()
            action = data.get("action")

            if action == "play":
                show_id = data.get("show_id")
                player = data.get("player_entity_id")
                start_time = float(data.get("start_time", 0.0))
                loop = data.get("loop")
                success = await self.engine.async_play(
                    show_id=show_id,
                    player_entity_id=player,
                    loop=loop,
                    start_time=start_time,
                )
                return self.json({"success": success})

            elif action == "stop":
                await self.engine.async_stop()
                return self.json({"success": True})

            elif action == "pause":
                await self.engine.async_pause()
                return self.json({"success": True})

            elif action == "resume":
                await self.engine.async_resume()
                return self.json({"success": True})

            elif action == "test_cue":
                entity_id = data.get("entity_id")
                cue = data.get("cue", {})
                if entity_id:
                    await self.engine.async_test_cue(entity_id, cue)
                    return self.json({"success": True})
                return self.json({"success": False, "error": "Missing entity_id"}, status_code=400)

            return self.json({"success": False, "error": f"Unknown action {action}"}, status_code=400)
        except Exception as err:
            _LOGGER.error("Control API error: %s", err)
            return self.json({"success": False, "error": str(err)}, status_code=500)


class LightShowMediaBrowseView(LightShowBaseView):
    """Browse Home Assistant / Music Assistant media sources."""
    url = f"{API_URL_PREFIX}/media/browse"
    name = "api:lightshow:media_browse"

    def __init__(self, mass_helper: MusicAssistantHelper) -> None:
        self.mass = mass_helper

    async def get(self, request: web.Request) -> web.Response:
        uri = request.query.get("uri")
        result = await self.mass.async_browse_media_source(uri)
        if result is None:
            return self.json({"error": "Failed to browse media source"}, status_code=400)
        return self.json(result)


class LightShowMediaResolveView(LightShowBaseView):
    """Resolve a media content ID to streamable URL."""
    url = f"{API_URL_PREFIX}/media/resolve"
    name = "api:lightshow:media_resolve"

    def __init__(self, mass_helper: MusicAssistantHelper) -> None:
        self.mass = mass_helper

    async def post(self, request: web.Request) -> web.Response:
        try:
            data = await request.json()
            content_id = data.get("media_content_id")
            if not content_id:
                return self.json({"success": False, "error": "Missing media_content_id"}, status_code=400)
            
            resolved = await self.mass.async_resolve_media(content_id)
            if resolved and resolved.get("url"):
                return self.json({
                    "success": True,
                    "url": resolved["url"],
                    "mime_type": resolved.get("mime_type")
                })
            return self.json({"success": False, "error": "Could not resolve stream URL"}, status_code=404)
        except Exception as err:
            _LOGGER.error("Resolve media error: %s", err)
            return self.json({"success": False, "error": str(err)}, status_code=500)


class LightShowFrontendView(LightShowBaseView):
    """Serve frontend static files (HTML, JS, CSS)."""
    url = f"{FRONTEND_URL}/{{filename:.*}}"
    name = "api:lightshow:frontend"

    async def get(self, request: web.Request, filename: str = "") -> web.Response:
        if not filename or filename == "/":
            filename = "index.html"

        curr_dir = os.path.dirname(__file__)
        frontend_dir = os.path.join(curr_dir, "frontend")
        safe_path = os.path.normpath(os.path.join(frontend_dir, filename))

        if not safe_path.startswith(frontend_dir) or not os.path.isfile(safe_path):
            return web.Response(status=404, text="Not Found")

        content_type, _ = mimetypes.guess_type(safe_path)
        if safe_path.endswith(".js"):
            content_type = "application/javascript"
        elif safe_path.endswith(".css"):
            content_type = "text/css"
        elif safe_path.endswith(".html"):
            content_type = "text/html"

        return web.FileResponse(safe_path, headers={"Content-Type": content_type or "text/plain"})

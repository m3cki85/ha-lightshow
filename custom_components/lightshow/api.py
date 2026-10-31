"""HTTP Views and REST API for LightShow Studio."""

import os
import mimetypes
import logging
from urllib.parse import quote, unquote
import aiohttp
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
    hass.http.register_view(LightShowMediaSearchView(mass_helper))
    hass.http.register_view(LightShowMediaActiveView(mass_helper))
    hass.http.register_view(LightShowMediaResolveView(mass_helper))
    hass.http.register_view(LightShowMediaProxyView(hass, mass_helper, storage))
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

    async def delete(self, request: web.Request, filename: str) -> web.Response:
        deleted = await self.storage.async_delete_audio_file(filename)
        return self.json({"success": deleted})


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
                show_data = data.get("show_data")
                if show_data:
                    show_id = await self.engine.storage.async_save_show(show_data)

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
        if not uri or uri == "root":
            # Fast-path: Return curated top-level hubs to prevent slow UPnP/DLNA full scan
            mass_top = await self.mass.async_browse_media_source("media-source://mass")
            if mass_top:
                return self.json(mass_top)
            # Fallback
            result = await self.mass.async_browse_media_source(None)
        else:
            result = await self.mass.async_browse_media_source(uri)

        if result is None:
            return self.json({"error": "Failed to browse media source"}, status_code=400)
        return self.json(result)


class LightShowMediaSearchView(LightShowBaseView):
    """Direct native search using Music Assistant action."""
    url = f"{API_URL_PREFIX}/media/search"
    name = "api:lightshow:media_search"

    def __init__(self, mass_helper: MusicAssistantHelper) -> None:
        self.mass = mass_helper

    async def get(self, request: web.Request) -> web.Response:
        query = request.query.get("q", "")
        limit = int(request.query.get("limit", 25))
        results = await self.mass.async_search(query, limit=limit)
        return self.json({"success": True, "query": query, "results": results})


class LightShowMediaActiveView(LightShowBaseView):
    """Get tracks currently playing or paused on media players for instant transfer."""
    url = f"{API_URL_PREFIX}/media/active"
    name = "api:lightshow:media_active"

    def __init__(self, mass_helper: MusicAssistantHelper) -> None:
        self.mass = mass_helper

    async def get(self, request: web.Request) -> web.Response:
        active = self.mass.get_active_tracks()
        return self.json({"success": True, "active": active})


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
            proxy_url = f"{API_URL_PREFIX}/media/proxy?media_content_id={quote(content_id)}"
            duration = resolved.get("duration", 0) if resolved else 0
            raw_url = resolved.get("url") if resolved else None

            return self.json({
                "success": True,
                "url": proxy_url,
                "raw_url": raw_url,
                "mime_type": resolved.get("mime_type") if resolved else "audio/mpeg",
                "duration": duration,
                "direct_stream_available": bool(raw_url),
            })
        except Exception as err:
            _LOGGER.error("Resolve media error: %s", err)
            return self.json({"success": False, "error": str(err)}, status_code=500)


class LightShowMediaProxyView(LightShowBaseView):
    """Proxy audio streams from Music Assistant & HA Media for browser waveform & playback."""
    url = f"{API_URL_PREFIX}/media/proxy"
    name = "api:lightshow:media_proxy"

    def __init__(self, hass: HomeAssistant, mass_helper: MusicAssistantHelper, storage: LightShowStorage) -> None:
        self.hass = hass
        self.mass = mass_helper
        self.storage = storage

    async def get(self, request: web.Request) -> web.Response:
        media_content_id = request.query.get("media_content_id")
        target_url = request.query.get("url")

        if media_content_id and not target_url:
            resolved = await self.mass.async_resolve_media(media_content_id)
            if resolved and resolved.get("url"):
                target_url = resolved["url"]

        if not target_url:
            return web.Response(status=404, text="No playable audio stream available for this item")

        # 1. Local LightShow upload file
        if "/api/lightshow/audio/" in target_url:
            filename = target_url.split("/api/lightshow/audio/")[-1].split("?")[0]
            filepath = self.storage.get_audio_file_path(filename)
            if filepath and os.path.isfile(filepath):
                content_type, _ = mimetypes.guess_type(filepath)
                return web.FileResponse(filepath, headers={
                    "Content-Type": content_type or "audio/mpeg",
                    "Access-Control-Allow-Origin": "*",
                    "Accept-Ranges": "bytes"
                })

        # 2. Proxy internal HA media or remote streaming URL
        try:
            from homeassistant.helpers.aiohttp_client import async_get_clientsession
            from homeassistant.helpers.network import get_url

            if target_url.startswith("/"):
                try:
                    base_url = get_url(self.hass, allow_internal=True, allow_ip=True)
                    full_url = f"{base_url}{target_url}"
                except Exception:
                    full_url = f"http://127.0.0.1:8123{target_url}"
            else:
                full_url = target_url

            session = async_get_clientsession(self.hass)
            req_headers = {}
            if "Range" in request.headers:
                req_headers["Range"] = request.headers["Range"]

            client_timeout = aiohttp.ClientTimeout(total=None, connect=10, sock_read=30)
            resp = await session.get(full_url, headers=req_headers, allow_redirects=True, timeout=client_timeout)

            headers = {
                "Content-Type": resp.headers.get("Content-Type", "audio/mpeg"),
                "Access-Control-Allow-Origin": "*",
                "Accept-Ranges": "bytes",
            }
            if "Content-Length" in resp.headers:
                headers["Content-Length"] = resp.headers["Content-Length"]
            if "Content-Range" in resp.headers:
                headers["Content-Range"] = resp.headers["Content-Range"]

            stream_response = web.StreamResponse(status=resp.status, headers=headers)
            await stream_response.prepare(request)

            try:
                async for chunk in resp.content.iter_chunked(65536):
                    await stream_response.write(chunk)
                await stream_response.write_eof()
            except (ConnectionResetError, aiohttp.ClientPayloadError, asyncio.CancelledError):
                pass

            return stream_response
        except Exception as err:
            _LOGGER.error("Failed to proxy media URL %s: %s", target_url, err)
            return web.Response(status=500, text=f"Proxy error: {err}")


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

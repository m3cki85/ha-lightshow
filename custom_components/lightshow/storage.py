"""Storage manager for LightShow Studio shows and audio assets."""

import os
import json
import logging
import asyncio
from datetime import datetime
from typing import Dict, List, Optional, Any
from homeassistant.core import HomeAssistant

from .const import DEFAULT_STORAGE_DIR, AUDIO_SUBDIR

_LOGGER = logging.getLogger(__name__)


class LightShowStorage:
    """Manages persistent JSON shows and audio assets in /config/lightshows/."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self.base_dir = hass.config.path(DEFAULT_STORAGE_DIR)
        self.audio_dir = os.path.join(self.base_dir, AUDIO_SUBDIR)
        self._ensure_directories()

    def _ensure_directories(self) -> None:
        """Ensure storage and audio directories exist."""
        os.makedirs(self.base_dir, exist_ok=True)
        os.makedirs(self.audio_dir, exist_ok=True)

    def _get_show_file_path(self, show_id: str) -> str:
        """Return the absolute path for a show file."""
        safe_id = "".join(c for c in show_id if c.isalnum() or c in ("-", "_")).strip()
        if not safe_id:
            safe_id = "show"
        return os.path.join(self.base_dir, f"{safe_id}.json")

    async def async_get_shows(self) -> List[Dict[str, Any]]:
        """List summary of all saved shows."""
        return await self.hass.async_add_executor_job(self._get_shows_sync)

    def _get_shows_sync(self) -> List[Dict[str, Any]]:
        shows = []
        if not os.path.exists(self.base_dir):
            return shows

        for filename in os.listdir(self.base_dir):
            if filename.endswith(".json"):
                show_id = filename[:-5]
                filepath = os.path.join(self.base_dir, filename)
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    
                    audio_info = data.get("audio", {})
                    tracks = data.get("tracks", [])
                    total_cues = sum(len(t.get("cues", [])) for t in tracks)

                    shows.append({
                        "id": data.get("id", show_id),
                        "name": data.get("name", show_id),
                        "description": data.get("description", ""),
                        "duration": data.get("duration", audio_info.get("duration", 0)),
                        "track_count": len(tracks),
                        "cue_count": total_cues,
                        "audio_title": audio_info.get("title", ""),
                        "audio_artist": audio_info.get("artist", ""),
                        "updated_at": data.get("updated_at", ""),
                    })
                except Exception as err:
                    _LOGGER.warning("Could not read show file %s: %s", filename, err)

        shows.sort(key=lambda s: s.get("name", "").lower())
        return shows

    async def async_get_show(self, show_id: str) -> Optional[Dict[str, Any]]:
        """Load full show data by ID."""
        return await self.hass.async_add_executor_job(self._get_show_sync, show_id)

    def _get_show_sync(self, show_id: str) -> Optional[Dict[str, Any]]:
        filepath = self._get_show_file_path(show_id)
        if not os.path.isfile(filepath):
            return None
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as err:
            _LOGGER.error("Error reading show %s: %s", show_id, err)
            return None

    async def async_save_show(self, show_data: Dict[str, Any]) -> str:
        """Save show data to JSON. Returns the show ID."""
        return await self.hass.async_add_executor_job(self._save_show_sync, show_data)

    def _save_show_sync(self, show_data: Dict[str, Any]) -> str:
        show_id = show_data.get("id")
        if not show_id:
            name = show_data.get("name", "show")
            show_id = "".join(c if c.isalnum() else "_" for c in name).lower()
            show_data["id"] = show_id

        show_data["updated_at"] = datetime.now().isoformat()
        filepath = self._get_show_file_path(show_id)

        # Atomic-like write
        temp_path = f"{filepath}.tmp"
        with open(temp_path, "w", encoding="utf-8") as f:
            json.dump(show_data, f, indent=2, ensure_ascii=False)
        os.replace(temp_path, filepath)

        _LOGGER.info("Saved lightshow '%s' to %s", show_id, filepath)
        return show_id

    async def async_delete_show(self, show_id: str) -> bool:
        """Delete a show file."""
        return await self.hass.async_add_executor_job(self._delete_show_sync, show_id)

    def _delete_show_sync(self, show_id: str) -> bool:
        filepath = self._get_show_file_path(show_id)
        if os.path.isfile(filepath):
            os.remove(filepath)
            _LOGGER.info("Deleted lightshow '%s'", show_id)
            return True
        return False

    async def async_list_audio_files(self) -> List[Dict[str, Any]]:
        """List all audio files stored in the audio directory."""
        return await self.hass.async_add_executor_job(self._list_audio_files_sync)

    def _list_audio_files_sync(self) -> List[Dict[str, Any]]:
        audio_files = []
        if not os.path.exists(self.audio_dir):
            return audio_files

        for filename in os.listdir(self.audio_dir):
            if filename.lower().endswith((".mp3", ".wav", ".ogg", ".flac", ".m4a")):
                path = os.path.join(self.audio_dir, filename)
                size_mb = round(os.path.getsize(path) / (1024 * 1024), 2)
                audio_files.append({
                    "filename": filename,
                    "size_mb": size_mb,
                    "url": f"/api/lightshow/audio/{filename}",
                })
        return audio_files

    def get_audio_file_path(self, filename: str) -> Optional[str]:
        """Get safe path to an audio file."""
        safe_name = os.path.basename(filename)
        path = os.path.join(self.audio_dir, safe_name)
        if os.path.isfile(path):
            return path
        return None

    async def async_delete_audio_file(self, filename: str) -> bool:
        """Delete an audio file from the audio directory."""
        return await self.hass.async_add_executor_job(self._delete_audio_file_sync, filename)

    def _delete_audio_file_sync(self, filename: str) -> bool:
        filepath = self.get_audio_file_path(filename)
        if filepath and os.path.isfile(filepath):
            try:
                os.remove(filepath)
                _LOGGER.info("Deleted audio file '%s'", filename)
                return True
            except Exception as err:
                _LOGGER.error("Failed to delete audio file %s: %s", filename, err)
        return False

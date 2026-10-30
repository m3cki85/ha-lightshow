"""Constants for the LightShow Studio integration."""

DOMAIN = "lightshow"

DATA_ENGINE = "engine"
DATA_STORAGE = "storage"

CONF_SHOW_ID = "show_id"
CONF_PLAYER_ENTITY_ID = "player_entity_id"
CONF_LOOP = "loop"

SERVICE_PLAY = "play"
SERVICE_STOP = "stop"
SERVICE_PAUSE = "pause"
SERVICE_RESUME = "resume"
SERVICE_TEST_CUE = "test_cue"

EVENT_PROGRESS = "lightshow_progress"
EVENT_STATE_CHANGED = "lightshow_state_changed"

API_URL_PREFIX = "/api/lightshow"
FRONTEND_URL = "/api/lightshow/frontend"

DEFAULT_TICK_RATE = 0.025  # 25ms tick rate (~40Hz)
DEFAULT_STORAGE_DIR = "lightshows"
AUDIO_SUBDIR = "audio"

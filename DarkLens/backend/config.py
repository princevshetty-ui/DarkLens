import os
import logging
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = "gemini-2.5-flash"
MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024
UVICORN_TIMEOUT_KEEP_ALIVE = int(os.getenv("UVICORN_TIMEOUT_KEEP_ALIVE", "75"))
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

# Configure logging
logging.basicConfig(
    level=LOG_LEVEL,
    format="[%(asctime)s] %(levelname)s [%(name)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)

logger = logging.getLogger(__name__)
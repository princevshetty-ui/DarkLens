import sys
from pathlib import Path

# Add backend directory to path so imports work
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

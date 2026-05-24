import sys
import os

APP_ROOT = "/usr/home/pluszek2026/domains/ramiarz.ebra.pl"
VENV_PYTHON = os.path.join(APP_ROOT, ".venv", "bin", "python3")

# Phusion Passenger: switch to venv interpreter if needed
if sys.executable != VENV_PYTHON:
    os.execl(VENV_PYTHON, VENV_PYTHON, *sys.argv)

# Make 'app' package importable
sys.path.insert(0, os.path.join(APP_ROOT, "backend"))

# chdir to backend/ so load_dotenv() finds .env there
os.chdir(os.path.join(APP_ROOT, "backend"))

from app.main import app
from a2wsgi import ASGIMiddleware

application = ASGIMiddleware(app)

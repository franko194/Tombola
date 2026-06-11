import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "backend"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.main import app as backend_app  # noqa: E402


class VercelApiAdapter:
    def __init__(self, asgi_app):
        self.asgi_app = asgi_app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            path = scope.get("path", "")
            for prefix in ("/api/index.py", "/api"):
                if path == prefix:
                    scope = {**scope, "path": "/"}
                    break
                if path.startswith(f"{prefix}/"):
                    scope = {**scope, "path": path[len(prefix) :]}
                    break
        await self.asgi_app(scope, receive, send)


app = VercelApiAdapter(backend_app)

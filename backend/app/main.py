from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import admin_router, api_router, attach_websocket, public_router
from app.core.config import settings
from app.services.container import ServiceContainer

app = FastAPI(title=settings.app_name, debug=settings.debug)

container = ServiceContainer(settings)
app.state.container = container
app.include_router(public_router)
app.include_router(api_router, prefix=settings.api_prefix)
app.include_router(admin_router, prefix=settings.admin_prefix)
static_dir = Path(__file__).resolve().parent / "static"
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")
attach_websocket(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root() -> dict:
    return {
        "name": settings.app_name,
        "docs": "/docs",
        "admin": settings.admin_prefix,
        "api": settings.api_prefix,
    }

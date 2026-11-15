"""
Main FastAPI Application Entry Point for GEOVISTA Intelligence Platform.

Configures:
- FastAPI app instance with metadata and OpenAPI documentation
- CORS Middleware configured for the React/OpenLayers frontend (http://localhost:3000)
- Global exception handlers for domain errors
- Router mounting (/health and /api/v1/*)
"""

from __future__ import annotations

import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.frontend_router import frontend_router
from app.api.v1.router import router as api_v1_router
from app.core.exceptions import GeoVistaError
from app.core.settings import settings

logger = logging.getLogger(__name__)

app = FastAPI(
    title="GEOVISTA Intelligence Platform API",
    description="Multi-Source Geospatial AI Backend for Earth Observation Modeling & Environmental Intelligence",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS for React/Vite Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(api_v1_router)
app.include_router(frontend_router)


@app.exception_handler(GeoVistaError)
async def domain_exception_handler(request: Request, exc: GeoVistaError) -> JSONResponse:
    return JSONResponse(
        status_code=400,
        content={"error_type": exc.__class__.__name__, "message": str(exc)},
    )


@app.get("/")
def root():
    return {
        "platform": "GEOVISTA Intelligence",
        "status": "online",
        "documentation": "/docs",
        "health": "/health",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.api_host, port=settings.api_port, reload=False)

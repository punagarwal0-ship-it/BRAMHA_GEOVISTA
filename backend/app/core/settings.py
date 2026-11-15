"""
app/core/settings.py
====================
Centralised application settings loaded from environment variables / .env file.
Uses Pydantic BaseSettings v2 for automatic parsing and validation.
"""

from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Any, Optional

from pydantic import field_validator, model_validator

try:
    from pydantic_settings import BaseSettings, SettingsConfigDict
except ImportError:
    # Graceful fallback when pydantic-settings is not yet installed
    from pydantic import BaseModel as BaseSettings  # type: ignore

    class SettingsConfigDict(dict):  # type: ignore
        def __init__(self, **kwargs):
            super().__init__(**kwargs)


class GeoVistaSettings(BaseSettings):
    """
    Master settings object for the GEOVISTA Intelligence ML backend.

    Priority (highest → lowest):
        1. Environment variables
        2. .env file (if present next to working directory)
        3. Field defaults
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ------------------------------------------------------------------
    # NASA Earthdata credentials
    # ------------------------------------------------------------------
    nasa_earthdata_username: str = ""
    nasa_earthdata_password: str = ""
    earthdata_token: Optional[str] = None

    # ------------------------------------------------------------------
    # ASF credentials
    # ------------------------------------------------------------------
    asf_username: Optional[str] = None
    asf_password: Optional[str] = None

    # ------------------------------------------------------------------
    # API server
    # ------------------------------------------------------------------
    geovista_api_host: str = "0.0.0.0"
    geovista_api_port: int = 8000

    # Comma-separated origins in env → list[str] in Python
    geovista_cors_origins: str = "http://localhost:3000"

    # ------------------------------------------------------------------
    # Storage
    # ------------------------------------------------------------------
    geovista_scratch_dir: Optional[Path] = None
    geovista_artifacts_dir: Optional[Path] = None

    # ------------------------------------------------------------------
    # Logging
    # ------------------------------------------------------------------
    geovista_log_level: str = "INFO"

    # ------------------------------------------------------------------
    # MLflow
    # ------------------------------------------------------------------
    mlflow_tracking_uri: str = "file:./mlruns"

    # ------------------------------------------------------------------
    # GPU / CUDA
    # ------------------------------------------------------------------
    cuda_visible_devices: Optional[str] = None

    # ------------------------------------------------------------------
    # Derived / computed properties (not from env)
    # ------------------------------------------------------------------
    @property
    def api_host(self) -> str:
        return self.geovista_api_host

    @property
    def api_port(self) -> int:
        return self.geovista_api_port

    @property
    def log_level(self) -> str:
        return self.geovista_log_level.upper()

    @property
    def cors_origins(self) -> list[str]:
        """Return parsed list of CORS origin strings."""
        return [o.strip() for o in self.geovista_cors_origins.split(",") if o.strip()]

    @property
    def scratch_dir(self) -> Path:
        """Return scratch directory, guaranteed to exist."""
        if self.geovista_scratch_dir is not None:
            return self.geovista_scratch_dir
        return Path(tempfile.gettempdir()) / "geovista_scratch"

    @property
    def artifacts_dir(self) -> Path:
        """Return artifacts directory, guaranteed to exist."""
        if self.geovista_artifacts_dir is not None:
            return self.geovista_artifacts_dir
        # Default: <backend root>/artifacts
        return Path(__file__).resolve().parents[2] / "artifacts"

    # ------------------------------------------------------------------
    # Validators
    # ------------------------------------------------------------------
    @field_validator("geovista_log_level")
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        valid = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        upper = v.upper()
        if upper not in valid:
            raise ValueError(f"log_level must be one of {valid}, got '{v}'")
        return upper

    @field_validator("geovista_api_port")
    @classmethod
    def validate_port(cls, v: int) -> int:
        if not (1 <= v <= 65535):
            raise ValueError(f"api_port must be in range 1-65535, got {v}")
        return v

    @model_validator(mode="after")
    def _ensure_directories(self) -> "GeoVistaSettings":
        """Auto-create scratch and artifacts directories on startup."""
        self.scratch_dir.mkdir(parents=True, exist_ok=True)
        self.artifacts_dir.mkdir(parents=True, exist_ok=True)
        return self

    # ------------------------------------------------------------------
    # Convenience helpers
    # ------------------------------------------------------------------
    def earthdata_auth(self) -> tuple[str, str] | None:
        """Return (username, password) tuple or None if credentials missing."""
        if self.nasa_earthdata_username and self.nasa_earthdata_password:
            return (self.nasa_earthdata_username, self.nasa_earthdata_password)
        return None

    def earthdata_headers(self) -> dict[str, str]:
        """Return Authorization headers preferring token over basic auth."""
        if self.earthdata_token:
            return {"Authorization": f"Bearer {self.earthdata_token}"}
        return {}

    def __repr__(self) -> str:
        return (
            f"GeoVistaSettings("
            f"host={self.api_host}:{self.api_port}, "
            f"log_level={self.log_level}, "
            f"scratch_dir={self.scratch_dir}, "
            f"artifacts_dir={self.artifacts_dir})"
        )


# ---------------------------------------------------------------------------
# Module-level singleton — import this everywhere:  from app.core.settings import settings
# ---------------------------------------------------------------------------
settings = GeoVistaSettings()

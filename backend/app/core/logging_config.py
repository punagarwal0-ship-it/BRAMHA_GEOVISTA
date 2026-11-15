"""
app/core/logging_config.py
==========================
Centralised logging configuration using Python's stdlib ``logging`` module
enhanced with ``rich`` for colourful, structured console output.

Usage
-----
    # This module auto-configures logging on import, so just import it early:
    from app.core import logging_config  # noqa: F401

    # Then get a named logger anywhere:
    from app.core.logging_config import get_logger
    logger = get_logger(__name__)
"""

from __future__ import annotations

import logging
import sys
from typing import Optional

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
_DEFAULT_LEVEL: str = "INFO"
_LOG_FORMAT: str = "%(message)s"  # Rich handler adds time/level itself

# Third-party loggers that produce too much noise at DEBUG/INFO
_NOISY_LOGGERS: list[str] = [
    "rasterio",
    "fiona",
    "fiona.ogrext",
    "shapely",
    "shapely.geos",
    "urllib3",
    "urllib3.connectionpool",
    "botocore",
    "boto3",
    "s3transfer",
    "asyncio",
    "PIL",
    "matplotlib",
    "h5py",
    "numexpr",
    "dask",
    "distributed",
    "fsspec",
    "aiohttp",
    "httpx",
]

_configured: bool = False


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def setup_logging(level: str = _DEFAULT_LEVEL) -> None:
    """
    Configure the root logger with a Rich console handler.

    Parameters
    ----------
    level:
        Logging level string (DEBUG | INFO | WARNING | ERROR | CRITICAL).
        Case-insensitive.

    Notes
    -----
    Calling this function multiple times is idempotent; subsequent calls
    update the root logger level but do not add duplicate handlers.
    """
    global _configured

    numeric_level = getattr(logging, level.upper(), logging.INFO)

    # --- Rich handler (colours + tracebacks) --------------------------------
    try:
        from rich.logging import RichHandler

        handler: logging.Handler = RichHandler(
            level=numeric_level,
            rich_tracebacks=True,
            tracebacks_show_locals=False,
            show_time=True,
            show_level=True,
            show_path=True,
            markup=True,
            log_time_format="[%Y-%m-%d %H:%M:%S]",
        )
    except ImportError:
        # Fallback to plain StreamHandler if rich is not installed
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter(
            fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        handler.setLevel(numeric_level)

    # --- Root logger --------------------------------------------------------
    root_logger = logging.getLogger()
    if not _configured:
        root_logger.handlers.clear()
        root_logger.addHandler(handler)
    root_logger.setLevel(numeric_level)

    # --- Suppress noisy third-party loggers ---------------------------------
    for name in _NOISY_LOGGERS:
        logging.getLogger(name).setLevel(logging.WARNING)

    _configured = True


def get_logger(name: Optional[str] = None) -> logging.Logger:
    """
    Return a named logger.

    Parameters
    ----------
    name:
        Logger name, typically ``__name__`` of the calling module.
        Defaults to the root logger.

    Returns
    -------
    logging.Logger
    """
    return logging.getLogger(name)


# ---------------------------------------------------------------------------
# Auto-configure on import using the settings singleton (if available)
# ---------------------------------------------------------------------------
def _auto_configure() -> None:
    try:
        from app.core.settings import settings

        setup_logging(settings.log_level)
    except Exception:
        # Settings not yet available (e.g. during early import or tests)
        setup_logging(_DEFAULT_LEVEL)


_auto_configure()

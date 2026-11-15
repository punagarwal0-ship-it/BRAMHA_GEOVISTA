"""
app/config/config_loader.py
============================
Project-level YAML configuration loader and validator.

The ``ProjectConfig`` dataclass mirrors the master YAML schema that users
provide to define an analysis run (AOI, date range, tasks, sensors, compute
settings, etc.).  ``load_project_config()`` parses a YAML file, validates
every required field with descriptive errors, resolves ``auto`` compute
settings via hardware detection, and returns a fully populated
:class:`ProjectConfig`.

Typical usage
-------------
    from app.config.config_loader import load_project_config

    cfg = load_project_config(Path("configs/my_project.yaml"))
    print(cfg.project_name, cfg.aoi.bbox)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import yaml

from app.core.exceptions import ConfigurationError

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Sub-dataclasses
# ---------------------------------------------------------------------------

@dataclass
class AoiConfig:
    """Area-of-Interest definition (mutually exclusive: bbox or geojson_path)."""

    bbox: Optional[list[float]] = None          # [west, south, east, north] in WGS-84
    geojson_path: Optional[str] = None          # Path to a GeoJSON file
    buffer_km: float = 0.0                      # Optional spatial buffer


@dataclass
class DateConfig:
    """Temporal extent."""

    start: str = ""   # ISO-8601 date, e.g. "2023-01-01"
    end: str = ""     # ISO-8601 date, e.g. "2023-12-31"


@dataclass
class SensorConfig:
    """Per-sensor activation and product preferences."""

    optical: list[str] = field(default_factory=lambda: ["sentinel2", "landsat8"])
    sar: list[str] = field(default_factory=lambda: ["sentinel1"])
    auxiliary: list[str] = field(default_factory=list)


@dataclass
class TaskConfig:
    """ML task definition."""

    name: str = ""
    enabled: bool = True
    model_type: str = "auto"           # e.g. "unet", "xgboost", "auto"
    output_resolution_m: int = 10
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass
class ComputeConfig:
    """Compute / hardware settings (may contain 'auto' strings)."""

    device: str = "auto"              # "cuda", "cpu", or "auto"
    batch_size: Any = "auto"          # int or "auto"
    num_workers: Any = "auto"         # int or "auto"
    mixed_precision: Any = "auto"     # bool or "auto"
    max_memory_gb: Optional[float] = None


@dataclass
class OutputConfig:
    """Output file and format settings."""

    base_dir: str = "outputs"
    formats: list[str] = field(default_factory=lambda: ["geotiff", "cog"])
    crs: str = "EPSG:4326"
    overwrite: bool = False


@dataclass
class ProjectConfig:
    """Root configuration object for a GEOVISTA analysis run."""

    # Required
    project_name: str = ""
    version: str = "1.0"

    # Sub-configs
    aoi: AoiConfig = field(default_factory=AoiConfig)
    dates: DateConfig = field(default_factory=DateConfig)
    sensors: SensorConfig = field(default_factory=SensorConfig)
    tasks: list[TaskConfig] = field(default_factory=list)
    compute: ComputeConfig = field(default_factory=ComputeConfig)
    output: OutputConfig = field(default_factory=OutputConfig)

    # Optional metadata
    description: str = ""
    tags: list[str] = field(default_factory=list)
    extra: dict[str, Any] = field(default_factory=dict)

    # Resolved datetime objects (populated by loader)
    _start_dt: Optional[datetime] = field(default=None, repr=False)
    _end_dt: Optional[datetime] = field(default=None, repr=False)

    @property
    def start_datetime(self) -> Optional[datetime]:
        return self._start_dt

    @property
    def end_datetime(self) -> Optional[datetime]:
        return self._end_dt


# ---------------------------------------------------------------------------
# Public functions
# ---------------------------------------------------------------------------

def load_yaml_config(path: Path) -> dict:
    """
    Load and parse a YAML file, returning the top-level mapping.

    Parameters
    ----------
    path:
        Path to the YAML file.

    Returns
    -------
    dict
        Parsed YAML content.

    Raises
    ------
    ConfigurationError
        If the file does not exist, cannot be parsed, or is not a mapping.
    """
    if not path.exists():
        raise ConfigurationError(
            f"Configuration file not found: {path}",
            details={"path": str(path)},
        )

    try:
        with open(path, "r", encoding="utf-8") as fh:
            data = yaml.safe_load(fh)
    except yaml.YAMLError as exc:
        raise ConfigurationError(
            f"YAML parse error in '{path}': {exc}",
            details={"path": str(path), "error": str(exc)},
        ) from exc

    if not isinstance(data, dict):
        raise ConfigurationError(
            f"Top-level YAML content must be a mapping, got {type(data).__name__}.",
            details={"path": str(path)},
        )

    return data


def validate_date_range(start: str, end: str) -> tuple[datetime, datetime]:
    """
    Parse and validate a date range.

    Parameters
    ----------
    start, end:
        ISO-8601 date strings (``YYYY-MM-DD`` or ``YYYY-MM-DDTHH:MM:SS``).

    Returns
    -------
    tuple[datetime, datetime]
        Parsed (start, end) datetimes.

    Raises
    ------
    ConfigurationError
        If dates are unparseable or start > end.
    """
    _fmts = ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%SZ")

    def _parse(s: str, label: str) -> datetime:
        for fmt in _fmts:
            try:
                return datetime.strptime(s, fmt)
            except ValueError:
                continue
        raise ConfigurationError(
            f"Cannot parse {label} date '{s}'. "
            "Expected ISO-8601 format: YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS.",
            details={label: s},
        )

    start_dt = _parse(start, "start")
    end_dt = _parse(end, "end")

    if start_dt > end_dt:
        raise ConfigurationError(
            f"start date '{start}' must not be after end date '{end}'.",
            details={"start": start, "end": end},
        )

    return start_dt, end_dt


def load_project_config(path: Path) -> ProjectConfig:
    """
    Load a project YAML file and return a validated :class:`ProjectConfig`.

    ``auto`` values in the ``compute`` section are resolved via
    :func:`~app.core.hardware.detect_hardware`.

    Parameters
    ----------
    path:
        Path to the project YAML file.

    Returns
    -------
    ProjectConfig

    Raises
    ------
    ConfigurationError
        On any validation failure.
    """
    raw = load_yaml_config(path)
    logger.info("Loading project config from '%s'", path)

    # --- Required top-level fields -----------------------------------------
    project_name = _require_str(raw, "project_name")
    version = str(raw.get("version", "1.0"))

    # --- AOI ----------------------------------------------------------------
    aoi_raw = _require_dict(raw, "aoi")
    aoi = _parse_aoi(aoi_raw)

    # --- Dates --------------------------------------------------------------
    dates_raw = _require_dict(raw, "dates")
    start_str = _require_str(dates_raw, "start", context="dates")
    end_str = _require_str(dates_raw, "end", context="dates")
    start_dt, end_dt = validate_date_range(start_str, end_str)
    dates = DateConfig(start=start_str, end=end_str)

    # --- Sensors ------------------------------------------------------------
    sensors_raw = raw.get("sensors", {})
    if not isinstance(sensors_raw, dict):
        raise ConfigurationError("'sensors' must be a mapping.")
    sensors = SensorConfig(
        optical=_as_str_list(sensors_raw.get("optical", ["sentinel2", "landsat8"])),
        sar=_as_str_list(sensors_raw.get("sar", ["sentinel1"])),
        auxiliary=_as_str_list(sensors_raw.get("auxiliary", [])),
    )

    # --- Tasks --------------------------------------------------------------
    tasks_raw = raw.get("tasks", [])
    if not isinstance(tasks_raw, list):
        raise ConfigurationError("'tasks' must be a list.")
    tasks = [_parse_task(t, i) for i, t in enumerate(tasks_raw)]
    if not tasks:
        raise ConfigurationError(
            "At least one task must be defined under 'tasks'.",
        )

    # --- Compute (resolve 'auto') -------------------------------------------
    compute_raw = raw.get("compute", {})
    if not isinstance(compute_raw, dict):
        raise ConfigurationError("'compute' must be a mapping.")
    compute = _parse_compute(compute_raw)

    # --- Output -------------------------------------------------------------
    output_raw = raw.get("output", {})
    if not isinstance(output_raw, dict):
        raise ConfigurationError("'output' must be a mapping.")
    output = OutputConfig(
        base_dir=str(output_raw.get("base_dir", "outputs")),
        formats=_as_str_list(output_raw.get("formats", ["geotiff", "cog"])),
        crs=str(output_raw.get("crs", "EPSG:4326")),
        overwrite=bool(output_raw.get("overwrite", False)),
    )

    cfg = ProjectConfig(
        project_name=project_name,
        version=version,
        aoi=aoi,
        dates=dates,
        sensors=sensors,
        tasks=tasks,
        compute=compute,
        output=output,
        description=str(raw.get("description", "")),
        tags=_as_str_list(raw.get("tags", [])),
        extra={k: v for k, v in raw.items() if k not in _KNOWN_KEYS},
        _start_dt=start_dt,
        _end_dt=end_dt,
    )

    logger.info(
        "Project config loaded: '%s' | %d tasks | %s → %s",
        cfg.project_name,
        len(cfg.tasks),
        start_str,
        end_str,
    )
    return cfg


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

_KNOWN_KEYS = {
    "project_name", "version", "description", "tags",
    "aoi", "dates", "sensors", "tasks", "compute", "output",
}


def _require_str(d: dict, key: str, context: str = "root") -> str:
    val = d.get(key)
    if not isinstance(val, str) or not val.strip():
        raise ConfigurationError(
            f"Required string field '{key}' is missing or empty in [{context}].",
            details={"field": key, "context": context},
        )
    return val.strip()


def _require_dict(d: dict, key: str, context: str = "root") -> dict:
    val = d.get(key)
    if not isinstance(val, dict):
        raise ConfigurationError(
            f"Required mapping field '{key}' is missing or not a mapping in [{context}].",
            details={"field": key, "context": context},
        )
    return val


def _as_str_list(val: Any) -> list[str]:
    if isinstance(val, list):
        return [str(v) for v in val]
    if isinstance(val, str):
        return [val]
    return []


def _parse_aoi(aoi_raw: dict) -> AoiConfig:
    bbox = aoi_raw.get("bbox")
    geojson_path = aoi_raw.get("geojson_path")
    buffer_km = float(aoi_raw.get("buffer_km", 0.0))

    if bbox is None and geojson_path is None:
        raise ConfigurationError(
            "AOI must specify either 'bbox' ([west, south, east, north]) "
            "or 'geojson_path'.",
        )

    if bbox is not None:
        if not isinstance(bbox, (list, tuple)) or len(bbox) != 4:
            raise ConfigurationError(
                "AOI 'bbox' must be a list of 4 numbers: [west, south, east, north].",
                details={"bbox": bbox},
            )
        bbox = [float(v) for v in bbox]
        west, south, east, north = bbox
        if not (-180 <= west <= 180 and -180 <= east <= 180):
            raise ConfigurationError(
                f"Longitude values must be in [-180, 180]; got west={west}, east={east}."
            )
        if not (-90 <= south <= 90 and -90 <= north <= 90):
            raise ConfigurationError(
                f"Latitude values must be in [-90, 90]; got south={south}, north={north}."
            )
        if south >= north:
            raise ConfigurationError(
                f"south ({south}) must be less than north ({north}) in bbox."
            )
        if west >= east:
            raise ConfigurationError(
                f"west ({west}) must be less than east ({east}) in bbox "
                "(anti-meridian crossing not supported)."
            )

    if geojson_path is not None:
        p = Path(str(geojson_path))
        if not p.exists():
            raise ConfigurationError(
                f"geojson_path '{geojson_path}' does not exist.",
                details={"geojson_path": str(geojson_path)},
            )

    return AoiConfig(bbox=bbox, geojson_path=str(geojson_path) if geojson_path else None, buffer_km=buffer_km)


def _parse_task(raw: Any, idx: int) -> TaskConfig:
    if not isinstance(raw, dict):
        raise ConfigurationError(
            f"Task at index {idx} must be a mapping, got {type(raw).__name__}."
        )
    name = raw.get("name", "")
    if not name:
        raise ConfigurationError(f"Task at index {idx} is missing a 'name' field.")
    return TaskConfig(
        name=str(name),
        enabled=bool(raw.get("enabled", True)),
        model_type=str(raw.get("model_type", "auto")),
        output_resolution_m=int(raw.get("output_resolution_m", 10)),
        extra={k: v for k, v in raw.items() if k not in {"name", "enabled", "model_type", "output_resolution_m"}},
    )


def _parse_compute(raw: dict) -> ComputeConfig:
    """Resolve 'auto' compute settings via hardware detection."""
    device_raw = raw.get("device", "auto")
    batch_raw = raw.get("batch_size", "auto")
    workers_raw = raw.get("num_workers", "auto")
    amp_raw = raw.get("mixed_precision", "auto")
    max_mem = raw.get("max_memory_gb")

    # Lazy import to avoid circular dependency and slow import at module level
    has_auto = any(str(v) == "auto" for v in [device_raw, batch_raw, workers_raw, amp_raw])
    profile = None
    if has_auto:
        try:
            from app.core.hardware import detect_hardware
            profile = detect_hardware()
        except Exception as exc:
            logger.warning("Hardware detection failed (%s); using CPU defaults.", exc)

    # Resolve device
    if str(device_raw) == "auto":
        device = profile.device if profile else "cpu"
    else:
        device = str(device_raw)

    # Resolve batch_size
    if str(batch_raw) == "auto":
        batch_size = profile.recommended_batch_size if profile else 2
    else:
        try:
            batch_size = int(batch_raw)
        except (TypeError, ValueError):
            raise ConfigurationError(
                f"compute.batch_size must be an integer or 'auto', got '{batch_raw}'."
            )

    # Resolve num_workers
    if str(workers_raw) == "auto":
        num_workers = profile.recommended_num_workers if profile else 2
    else:
        try:
            num_workers = int(workers_raw)
        except (TypeError, ValueError):
            raise ConfigurationError(
                f"compute.num_workers must be an integer or 'auto', got '{workers_raw}'."
            )

    # Resolve mixed_precision
    if str(amp_raw) == "auto":
        mixed_precision = profile.amp_supported if profile else False
    elif isinstance(amp_raw, bool):
        mixed_precision = amp_raw
    else:
        mixed_precision = str(amp_raw).lower() in ("true", "1", "yes")

    return ComputeConfig(
        device=device,
        batch_size=batch_size,
        num_workers=num_workers,
        mixed_precision=mixed_precision,
        max_memory_gb=float(max_mem) if max_mem is not None else None,
    )

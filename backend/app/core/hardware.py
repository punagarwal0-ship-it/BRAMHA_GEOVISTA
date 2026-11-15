"""
app/core/hardware.py
====================
Hardware detection and device-selection utilities for the GEOVISTA ML backend.

Responsibilities
----------------
* Detect available GPU(s), VRAM, CUDA version.
* Measure available system RAM and logical CPU core count.
* Recommend sensible batch sizes and DataLoader workers.
* Expose a simple ``get_device()`` helper used throughout the codebase.

Usage
-----
    from app.core.hardware import detect_hardware, get_device, auto_batch_size

    profile = detect_hardware()
    device  = get_device()
    bs      = auto_batch_size("medium")
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

import psutil
import torch

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# VRAM → batch-size lookup table (conservative, leaves ~20 % headroom)
# Format: (min_vram_gb, batch_size)  — first matching row wins
# ---------------------------------------------------------------------------
_VRAM_BATCH_TABLE: dict[str, list[tuple[float, int]]] = {
    # (min_vram_gb, batch_size)
    "small": [
        (24.0, 64),
        (16.0, 32),
        (8.0,  16),
        (4.0,  8),
        (0.0,  4),
    ],
    "medium": [
        (24.0, 32),
        (16.0, 16),
        (8.0,  8),
        (4.0,  4),
        (0.0,  2),
    ],
    "large": [
        (24.0, 16),
        (16.0, 8),
        (8.0,  4),
        (4.0,  2),
        (0.0,  1),
    ],
}

_CPU_BATCH_SIZE: dict[str, int] = {"small": 4, "medium": 2, "large": 1}


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class HardwareProfile:
    """Snapshot of the available hardware resources."""

    device: str                    # "cuda" or "cpu"
    gpu_name: Optional[str]        # e.g. "NVIDIA GeForce RTX 4090"
    gpu_vram_gb: Optional[float]   # Total VRAM in GiB
    ram_gb: float                  # Total system RAM in GiB
    cpu_cores: int                 # Logical (hyper-threaded) core count
    recommended_batch_size: int    # For a "medium" complexity model
    recommended_num_workers: int   # For DataLoader
    amp_supported: bool            # Automatic Mixed Precision usable?
    cuda_version: Optional[str]    # e.g. "12.1"
    torch_version: str             # e.g. "2.3.0"
    extra: dict = field(default_factory=dict)  # Additional diagnostics


# ---------------------------------------------------------------------------
# Core functions
# ---------------------------------------------------------------------------

def detect_hardware() -> HardwareProfile:
    """
    Probe the runtime environment and return a :class:`HardwareProfile`.

    Does **not** raise – falls back gracefully to CPU-only on any error.
    """
    torch_version = torch.__version__

    # --- RAM & CPU ----------------------------------------------------------
    mem = psutil.virtual_memory()
    ram_gb = round(mem.total / (1024 ** 3), 2)
    cpu_cores = psutil.cpu_count(logical=True) or 1

    # --- GPU ----------------------------------------------------------------
    if torch.cuda.is_available():
        device = "cuda"
        idx = torch.cuda.current_device()
        gpu_name: Optional[str] = torch.cuda.get_device_name(idx)

        props = torch.cuda.get_device_properties(idx)
        gpu_vram_gb: Optional[float] = round(props.total_memory / (1024 ** 3), 2)

        cuda_version: Optional[str] = torch.version.cuda  # e.g. "12.1"

        # AMP is supported on compute capability >= 7.0 (Volta+)
        amp_supported = props.major >= 7

        recommended_batch_size = _vram_to_batch_size(gpu_vram_gb, "medium")
    else:
        device = "cpu"
        gpu_name = None
        gpu_vram_gb = None
        cuda_version = None
        amp_supported = False
        recommended_batch_size = _CPU_BATCH_SIZE["medium"]

    # Leave ~2 cores for the OS / data augmentation overhead
    recommended_num_workers = max(1, min(cpu_cores - 2, 8))

    extra: dict = {}
    if torch.cuda.is_available():
        extra["gpu_count"] = torch.cuda.device_count()
        extra["cuda_arch"] = (
            f"{torch.cuda.get_device_properties(0).major}."
            f"{torch.cuda.get_device_properties(0).minor}"
        )

    return HardwareProfile(
        device=device,
        gpu_name=gpu_name,
        gpu_vram_gb=gpu_vram_gb,
        ram_gb=ram_gb,
        cpu_cores=cpu_cores,
        recommended_batch_size=recommended_batch_size,
        recommended_num_workers=recommended_num_workers,
        amp_supported=amp_supported,
        cuda_version=cuda_version,
        torch_version=torch_version,
        extra=extra,
    )


def get_device() -> torch.device:
    """
    Return the best available :class:`torch.device`.

    Returns ``cuda`` when a CUDA-capable GPU is detected, otherwise ``cpu``.
    """
    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


def auto_batch_size(model_complexity: str = "medium") -> int:
    """
    Return a recommended batch size for the given model complexity tier.

    Parameters
    ----------
    model_complexity:
        One of ``"small"``, ``"medium"``, or ``"large"``.
        * small  – lightweight models (ViT-Tiny, MobileNet, shallow CNNs)
        * medium – standard models (ResNet-50, U-Net, XGBoost on tabular)
        * large  – heavy models (ViT-L, Swin-B, SAR SSL pre-training)

    Returns
    -------
    int
        Conservative batch size that fits in available VRAM (or RAM on CPU).
    """
    complexity = model_complexity.lower()
    if complexity not in _VRAM_BATCH_TABLE:
        raise ValueError(
            f"model_complexity must be 'small', 'medium', or 'large'; got '{model_complexity}'"
        )

    if torch.cuda.is_available():
        props = torch.cuda.get_device_properties(torch.cuda.current_device())
        vram_gb = props.total_memory / (1024 ** 3)
        return _vram_to_batch_size(vram_gb, complexity)

    return _CPU_BATCH_SIZE[complexity]


def log_hardware_summary(profile: HardwareProfile) -> None:
    """
    Emit a human-readable summary of *profile* at INFO level.

    Parameters
    ----------
    profile:
        A :class:`HardwareProfile` returned by :func:`detect_hardware`.
    """
    sep = "=" * 60
    logger.info(sep)
    logger.info("GEOVISTA Hardware Profile")
    logger.info(sep)
    logger.info("  Torch version        : %s", profile.torch_version)
    logger.info("  Compute device       : %s", profile.device.upper())

    if profile.device == "cuda":
        logger.info("  GPU name             : %s", profile.gpu_name)
        logger.info("  GPU VRAM             : %.2f GiB", profile.gpu_vram_gb)
        logger.info("  CUDA version         : %s", profile.cuda_version)
        logger.info("  AMP (fp16) supported : %s", profile.amp_supported)
        if "gpu_count" in profile.extra:
            logger.info("  GPU count            : %d", profile.extra["gpu_count"])
        if "cuda_arch" in profile.extra:
            logger.info("  CUDA compute cap.    : %s", profile.extra["cuda_arch"])
    else:
        logger.info("  (No CUDA GPU detected – running on CPU)")

    logger.info("  System RAM           : %.2f GiB", profile.ram_gb)
    logger.info("  Logical CPU cores    : %d", profile.cpu_cores)
    logger.info("  Rec. batch size      : %d (medium complexity)", profile.recommended_batch_size)
    logger.info("  Rec. num_workers     : %d", profile.recommended_num_workers)
    logger.info(sep)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _vram_to_batch_size(vram_gb: float, complexity: str) -> int:
    """Look up batch size from VRAM amount using the lookup table."""
    table = _VRAM_BATCH_TABLE[complexity]
    for min_vram, bs in table:
        if vram_gb >= min_vram:
            return bs
    return 1  # ultra-conservative fallback


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    hw = detect_hardware()
    log_hardware_summary(hw)
    print("\n✓ Hardware detection completed successfully.")

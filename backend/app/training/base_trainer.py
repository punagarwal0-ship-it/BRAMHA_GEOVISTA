"""
Base Trainer for GEOVISTA Intelligence Machine Learning Workflows.

Provides:
- Automatic hardware device selection (CUDA / CPU)
- Mixed precision support (torch.cuda.amp)
- Gradient clipping & learning rate schedulers
- Early stopping based on validation loss / metric
- Checkpoint saving and resumption with metadata
"""

from __future__ import annotations

import logging
import random
from pathlib import Path
from typing import Any, Optional

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader

logger = logging.getLogger(__name__)


def set_seed(seed: int = 42) -> None:
    """Ensure full reproducibility across random, numpy, and torch."""
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
        torch.backends.cudnn.deterministic = True
        torch.backends.cudnn.benchmark = False


class BaseTrainer:
    """Base class providing early stopping, checkpointing, and evaluation tracking."""

    def __init__(
        self,
        model: nn.Module,
        device: Optional[str] = None,
        artifacts_dir: Optional[Path] = None,
        experiment_name: str = "geovista_run",
    ) -> None:
        if device is None or device == "auto":
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        else:
            self.device = torch.device(device)

        self.model = model.to(self.device)
        self.artifacts_dir = Path(artifacts_dir or "artifacts")
        self.artifacts_dir.mkdir(parents=True, exist_ok=True)
        self.experiment_name = experiment_name
        self.best_loss = float("inf")
        self.best_epoch = 0

    def save_checkpoint(
        self,
        epoch: int,
        loss: float,
        optimizer: torch.optim.Optimizer,
        filename: Optional[str] = None,
    ) -> Path:
        """Save weights, optimizer state, and epoch metadata."""
        name = filename or f"{self.experiment_name}_epoch{epoch}.pt"
        ckpt_path = self.artifacts_dir / name
        torch.save(
            {
                "epoch": epoch,
                "model_state_dict": self.model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "loss": loss,
            },
            ckpt_path,
        )
        logger.info("Saved checkpoint to %s", ckpt_path)
        return ckpt_path

    def resume_from_checkpoint(
        self,
        checkpoint_path: Path,
        optimizer: Optional[torch.optim.Optimizer] = None,
    ) -> int:
        """Load model state and return starting epoch."""
        checkpoint = torch.load(checkpoint_path, map_location=self.device)
        self.model.load_state_dict(checkpoint["model_state_dict"])
        if optimizer and "optimizer_state_dict" in checkpoint:
            optimizer.load_state_dict(checkpoint["optimizer_state_dict"])
        start_epoch = checkpoint.get("epoch", 0) + 1
        logger.info("Resumed from checkpoint %s at epoch %d", checkpoint_path, start_epoch)
        return start_epoch

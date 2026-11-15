"""
Base model class for all GEOVISTA ML models.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
import logging

import torch
import torch.nn as nn

logger = logging.getLogger(__name__)


class BaseGeoVistaModel(ABC, nn.Module):
    """Base class for all GEOVISTA ML models.

    Every concrete model must declare:
        task          – one of 'vegetation', 'landcover', 'change_detection',
                        'flood', 'coastal', 'deformation'
        model_type    – e.g. 'baseline_rf', 'baseline_xgb', 'unet',
                        'temporal_lstm', etc.
        input_bands   – list of band names expected by the model
        target_description – human-readable description of the prediction target
    """

    task: str
    model_type: str
    input_bands: list[str]
    target_description: str
    is_experimental: bool = False

    # ------------------------------------------------------------------
    # Abstract interface
    # ------------------------------------------------------------------

    @abstractmethod
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Standard PyTorch forward pass."""
        ...

    @abstractmethod
    def predict(self, x: torch.Tensor) -> dict:
        """Run inference and return a structured result.

        Returns
        -------
        dict with keys:
            'prediction'  : torch.Tensor  – model output
            'confidence'  : torch.Tensor | None
            'metadata'    : dict          – task-specific extras
        """
        ...

    @abstractmethod
    def get_config(self) -> dict:
        """Return a JSON-serialisable dict describing model hyper-parameters."""
        ...

    # ------------------------------------------------------------------
    # Checkpoint helpers
    # ------------------------------------------------------------------

    def save(
        self,
        path: Path,
        optimizer_state: dict | None = None,
        epoch: int = 0,
        metrics: dict | None = None,
    ) -> None:
        """Save model checkpoint with metadata."""
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        checkpoint = {
            "model_state_dict": self.state_dict(),
            "optimizer_state_dict": optimizer_state,
            "epoch": epoch,
            "task": self.task,
            "model_type": self.model_type,
            "metrics": metrics or {},
            "config": self.get_config(),
        }
        torch.save(checkpoint, path)
        logger.info("Checkpoint saved to %s (epoch %d)", path, epoch)

    @classmethod
    def load(cls, path: Path, device: str = "cpu") -> "BaseGeoVistaModel":
        """Load a model checkpoint.

        Subclasses should override this if they need to reconstruct the
        model from the stored config before loading state_dict.
        """
        path = Path(path)
        checkpoint = torch.load(path, map_location=device)
        config = checkpoint.get("config", {})
        model = cls(**config)
        model.load_state_dict(checkpoint["model_state_dict"])
        model.to(device)
        logger.info(
            "Loaded %s/%s from %s (epoch %d)",
            checkpoint.get("task"),
            checkpoint.get("model_type"),
            path,
            checkpoint.get("epoch", 0),
        )
        return model

    # ------------------------------------------------------------------
    # Utility
    # ------------------------------------------------------------------

    def count_parameters(self) -> int:
        """Return number of trainable parameters."""
        return sum(p.numel() for p in self.parameters() if p.requires_grad)

    def __repr__(self) -> str:  # noqa: D105
        base = super().__repr__()
        return (
            f"{self.__class__.__name__}("
            f"task={getattr(self, 'task', '?')}, "
            f"model_type={getattr(self, 'model_type', '?')}, "
            f"params={self.count_parameters():,})\n{base}"
        )

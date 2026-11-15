"""
Model Registry and Artifact Tracking Service for GEOVISTA Intelligence.

Tracks:
- Registered models across all 6 tasks
- Model weights filepaths (.pt / joblib)
- Validation evaluation metrics and confusion matrices
- Provenance and hyperparameters
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)


class ModelRegistry:
    """Manages trained model discovery, metadata retrieval, and evaluation tracking."""

    def __init__(self, registry_file: Optional[Path] = None) -> None:
        self.registry_file = registry_file or Path("artifacts/model_registry.json")
        self._registry: dict[str, dict[str, Any]] = {}
        self._load()

    def _load(self) -> None:
        if self.registry_file.exists():
            try:
                with open(self.registry_file, "r", encoding="utf-8") as f:
                    self._registry = json.load(f)
            except Exception as e:
                logger.warning("Could not read registry file %s: %s", self.registry_file, e)

    def _save(self) -> None:
        self.registry_file.parent.mkdir(parents=True, exist_ok=True)
        try:
            with open(self.registry_file, "w", encoding="utf-8") as f:
                json.dump(self._registry, f, indent=2)
        except Exception as e:
            logger.error("Failed to save registry file: %s", e)

    def register_model(
        self,
        model_id: str,
        task: str,
        model_type: str,
        checkpoint_path: str,
        metrics: dict[str, Any],
        config: dict[str, Any],
    ) -> None:
        """Register a newly trained model with evaluation metrics."""
        self._registry[model_id] = {
            "model_id": model_id,
            "task": task,
            "model_type": model_type,
            "checkpoint_path": checkpoint_path,
            "metrics": metrics,
            "config": config,
            "registered_at": json.loads(json.dumps(Path(checkpoint_path).stat().st_mtime if Path(checkpoint_path).exists() else 0)),
        }
        self._save()
        logger.info("Registered model %s for task %s", model_id, task)

    def list_models(self, task: Optional[str] = None) -> list[dict[str, Any]]:
        models = list(self._registry.values())
        if task:
            models = [m for m in models if m["task"] == task]
        return models

    def get_model(self, model_id: str) -> Optional[dict[str, Any]]:
        return self._registry.get(model_id)

    def get_best_model(self, task: str) -> Optional[dict[str, Any]]:
        """Return the best model for a task based on primary evaluation metric."""
        candidates = self.list_models(task)
        if not candidates:
            return None
        # Best by RMSE (lowest) for vegetation, or mIoU/F1 (highest) for segmentation/flood
        if task == "vegetation":
            return min(candidates, key=lambda c: c.get("metrics", {}).get("rmse", float("inf")))
        elif task in ("landcover", "change_detection", "flood", "coastal", "deformation"):
            return max(candidates, key=lambda c: c.get("metrics", {}).get("mean_iou", c.get("metrics", {}).get("iou", 0.0)))
        return candidates[0]


# Module-level singleton
model_registry = ModelRegistry()

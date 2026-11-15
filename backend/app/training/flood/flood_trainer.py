"""
Flood Inundation & SAR Water Model Training Orchestrator for GEOVISTA Intelligence.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Optional

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader

from app.models.flood.flood_models import FloodUNet
from app.training.base_trainer import BaseTrainer

logger = logging.getLogger(__name__)


class FloodTrainer(BaseTrainer):
    """Trainer for SAR dual-pol FloodUNet segmentation."""

    def __init__(
        self,
        model: FloodUNet,
        device: Optional[str] = None,
        artifacts_dir: Optional[Path] = None,
        experiment_name: str = "flood_sar_unet",
    ) -> None:
        super().__init__(model, device=device, artifacts_dir=artifacts_dir, experiment_name=experiment_name)

    def fit(
        self,
        train_loader: DataLoader,
        val_loader: DataLoader,
        epochs: int = 15,
        lr: float = 1e-3,
        patience: int = 5,
        pos_weight: float = 4.0,  # Floods are typically rare (< 5% of pixels)
    ) -> dict[str, list[float]]:
        """Run training with positive class-weighted BCE loss."""
        weight_tensor = torch.tensor([pos_weight], device=self.device)
        criterion = nn.BCEWithLogitsLoss(pos_weight=weight_tensor)
        optimizer = torch.optim.Adam(self.model.parameters(), lr=lr)

        history: dict[str, list[float]] = {"train_loss": [], "val_loss": [], "val_iou": []}
        epochs_no_improve = 0

        for epoch in range(1, epochs + 1):
            self.model.train()
            train_losses = []
            for batch in train_loader:
                sar = batch["sar"].to(self.device)
                mask = batch["mask"].to(self.device)

                optimizer.zero_grad()
                logits = self.model(sar)
                loss = criterion(logits, mask)
                loss.backward()
                nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
                optimizer.step()
                train_losses.append(loss.item())

            train_loss = float(np.mean(train_losses))

            # Validation
            val_loss, iou = self._validate_epoch(val_loader, criterion)
            history["train_loss"].append(train_loss)
            history["val_loss"].append(val_loss)
            history["val_iou"].append(iou)

            logger.info("Epoch %d/%d - Train Loss: %.4f - Val Loss: %.4f - Flood IoU: %.4f", epoch, epochs, train_loss, val_loss, iou)

            if val_loss < self.best_loss:
                self.best_loss = val_loss
                self.best_epoch = epoch
                self.save_checkpoint(epoch, val_loss, optimizer, f"{self.experiment_name}_best.pt")
                epochs_no_improve = 0
            else:
                epochs_no_improve += 1
                if epochs_no_improve >= patience:
                    logger.info("Early stopping at epoch %d", epoch)
                    break

        return history

    def _validate_epoch(self, val_loader: DataLoader, criterion: nn.Module) -> tuple[float, float]:
        self.model.eval()
        val_losses = []
        inter = 0.0
        union = 0.0

        with torch.no_grad():
            for batch in val_loader:
                sar = batch["sar"].to(self.device)
                mask = batch["mask"].to(self.device)

                logits = self.model(sar)
                val_losses.append(criterion(logits, mask).item())

                preds = (torch.sigmoid(logits) > 0.5).cpu().numpy().astype(bool)
                targets = (mask > 0.5).cpu().numpy().astype(bool)

                inter += float(np.logical_and(preds, targets).sum())
                union += float(np.logical_or(preds, targets).sum())

        val_loss = float(np.mean(val_losses)) if val_losses else 0.0
        iou = float(inter / union) if union > 0 else 0.0
        return val_loss, iou

    def evaluate(self, test_loader: DataLoader) -> dict[str, float]:
        """Compute test Precision, Recall, F1, and IoU for flood detection."""
        self.model.eval()
        tp, fp, fn = 0, 0, 0

        with torch.no_grad():
            for batch in test_loader:
                sar = batch["sar"].to(self.device)
                mask = batch["mask"].to(self.device)

                probs = self.model.predict_flood_probability(sar)
                preds = (probs > 0.5).cpu().numpy().astype(bool)
                targets = (mask > 0.5).cpu().numpy().astype(bool)

                tp += int(np.logical_and(preds, targets).sum())
                fp += int(np.logical_and(preds, ~targets).sum())
                fn += int(np.logical_and(~preds, targets).sum())

        prec = float(tp / (tp + fp)) if (tp + fp) > 0 else 0.0
        rec = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0
        f1 = float(2 * prec * rec / (prec + rec)) if (prec + rec) > 0 else 0.0
        iou = float(tp / (tp + fp + fn)) if (tp + fp + fn) > 0 else 0.0

        return {"precision": prec, "recall": rec, "f1": f1, "iou": iou}

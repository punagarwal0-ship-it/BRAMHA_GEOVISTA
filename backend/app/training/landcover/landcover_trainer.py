"""
Land-Cover Semantic Segmentation Trainer for GEOVISTA Intelligence.

Handles:
- Cross-entropy loss with class weights
- IoU, Mean IoU, Overall Accuracy, Precision, Recall, F1
- Confusion matrix generation
- Checkpointing, early stopping, and GPU/CPU detection
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Optional

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader

from app.models.landcover.unet import UNet
from app.training.base_trainer import BaseTrainer

logger = logging.getLogger(__name__)


class LandCoverTrainer(BaseTrainer):
    """Training and evaluation orchestrator for U-Net land cover segmentation."""

    def __init__(
        self,
        model: nn.Module,
        num_classes: int = 11,
        device: Optional[str] = None,
        artifacts_dir: Optional[Path] = None,
        experiment_name: str = "landcover_unet",
    ) -> None:
        super().__init__(model, device=device, artifacts_dir=artifacts_dir, experiment_name=experiment_name)
        self.num_classes = num_classes

    def fit(
        self,
        train_loader: DataLoader,
        val_loader: DataLoader,
        epochs: int = 20,
        lr: float = 1e-3,
        patience: int = 5,
        class_weights: Optional[torch.Tensor] = None,
    ) -> dict[str, list[float]]:
        """Run training and validation loops with cross entropy loss."""
        weights = class_weights.to(self.device) if class_weights is not None else None
        criterion = nn.CrossEntropyLoss(weight=weights, ignore_index=255)
        optimizer = torch.optim.Adam(self.model.parameters(), lr=lr)

        history: dict[str, list[float]] = {"train_loss": [], "val_loss": [], "val_miou": []}
        epochs_no_improve = 0

        for epoch in range(1, epochs + 1):
            self.model.train()
            train_losses = []
            for batch in train_loader:
                img = batch["image"].to(self.device)
                mask = batch["mask"].to(self.device)

                optimizer.zero_grad()
                logits = self.model(img)
                loss = criterion(logits, mask)
                loss.backward()
                nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
                optimizer.step()
                train_losses.append(loss.item())

            train_loss = float(np.mean(train_losses))

            # Validation with IoU computation
            val_loss, miou = self._validate_epoch(val_loader, criterion)
            history["train_loss"].append(train_loss)
            history["val_loss"].append(val_loss)
            history["val_miou"].append(miou)

            logger.info(
                "Epoch %d/%d - Train Loss: %.4f - Val Loss: %.4f - Val mIoU: %.4f",
                epoch, epochs, train_loss, val_loss, miou
            )

            if val_loss < self.best_loss:
                self.best_loss = val_loss
                self.best_epoch = epoch
                self.save_checkpoint(epoch, val_loss, optimizer, f"{self.experiment_name}_best.pt")
                epochs_no_improve = 0
            else:
                epochs_no_improve += 1
                if epochs_no_improve >= patience:
                    logger.info("Early stopping triggered at epoch %d", epoch)
                    break

        return history

    def _validate_epoch(self, val_loader: DataLoader, criterion: nn.Module) -> tuple[float, float]:
        self.model.eval()
        val_losses = []
        total_intersection = np.zeros(self.num_classes)
        total_union = np.zeros(self.num_classes)

        with torch.no_grad():
            for batch in val_loader:
                img = batch["image"].to(self.device)
                mask = batch["mask"].to(self.device)
                logits = self.model(img)
                loss = criterion(logits, mask)
                val_losses.append(loss.item())

                preds = torch.argmax(logits, dim=1).cpu().numpy()
                targets = mask.cpu().numpy()

                for c in range(self.num_classes):
                    pred_c = preds == c
                    target_c = targets == c
                    total_intersection[c] += np.logical_and(pred_c, target_c).sum()
                    total_union[c] += np.logical_or(pred_c, target_c).sum()

        val_loss = float(np.mean(val_losses)) if val_losses else 0.0
        ious = np.divide(
            total_intersection,
            total_union,
            out=np.zeros_like(total_intersection),
            where=total_union > 0,
        )
        valid_ious = [ious[c] for c in range(self.num_classes) if total_union[c] > 0]
        miou = float(np.mean(valid_ious)) if valid_ious else 0.0
        return val_loss, miou

    def evaluate_test_set(self, test_loader: DataLoader) -> dict[str, Any]:
        """Compute complete test metrics: confusion matrix, overall accuracy, per-class F1 and IoU."""
        self.model.eval()
        all_preds = []
        all_targets = []

        with torch.no_grad():
            for batch in test_loader:
                img = batch["image"].to(self.device)
                mask = batch["mask"].to(self.device)
                logits = self.model(img)
                preds = torch.argmax(logits, dim=1).cpu().numpy()
                targets = mask.cpu().numpy()

                valid = targets != 255
                all_preds.append(preds[valid])
                all_targets.append(targets[valid])

        y_pred = np.concatenate(all_preds)
        y_true = np.concatenate(all_targets)

        # Accuracy
        oa = float(np.mean(y_pred == y_true))

        # Confusion Matrix
        cm = np.zeros((self.num_classes, self.num_classes), dtype=np.int64)
        for t, p in zip(y_true, y_pred):
            if 0 <= t < self.num_classes and 0 <= p < self.num_classes:
                cm[t, p] += 1

        # Per-class metrics
        per_class_iou = {}
        per_class_f1 = {}
        for c in range(self.num_classes):
            tp = cm[c, c]
            fp = np.sum(cm[:, c]) - tp
            fn = np.sum(cm[c, :]) - tp
            denom_iou = tp + fp + fn
            denom_f1 = 2 * tp + fp + fn
            per_class_iou[c] = float(tp / denom_iou) if denom_iou > 0 else 0.0
            per_class_f1[c] = float(2 * tp / denom_f1) if denom_f1 > 0 else 0.0

        miou = float(np.mean(list(per_class_iou.values())))

        return {
            "overall_accuracy": oa,
            "mean_iou": miou,
            "per_class_iou": per_class_iou,
            "per_class_f1": per_class_f1,
            "confusion_matrix": cm.tolist(),
        }

    # Alias for uniform interface across all trainers
    evaluate = evaluate_test_set

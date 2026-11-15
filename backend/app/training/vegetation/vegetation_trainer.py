"""
Vegetation Model Training & Forecasting Orchestrator for GEOVISTA Intelligence.

Supports:
- Statistical baseline (climatological persistence / moving average)
- Random Forest / XGBoost tabular models
- Temporal deep learning: PyTorch LSTM, TCN, and Transformer
- Evaluation: MAE, RMSE, R², and prediction bounds
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Optional

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader

from app.models.vegetation.vegetation_models import VegetationLSTM, VegetationTCN
from app.training.base_trainer import BaseTrainer

logger = logging.getLogger(__name__)


class VegetationStatisticalBaseline:
    """Statistical seasonal climatology baseline for vegetation forecasting."""

    def __init__(self, window_size: int = 3) -> None:
        self.window_size = window_size

    def forecast_persistence(self, sequence: np.ndarray, horizon: int = 6) -> np.ndarray:
        """Repeat the last observed NDVI value over the forecasting horizon."""
        last_val = sequence[-1, 0]  # Assuming first column is NDVI
        return np.full((horizon,), last_val, dtype=np.float32)

    def forecast_moving_average(self, sequence: np.ndarray, horizon: int = 6) -> np.ndarray:
        """Forecast the mean of the trailing k composite periods."""
        mean_val = np.nanmean(sequence[-self.window_size :, 0])
        return np.full((horizon,), mean_val, dtype=np.float32)


class VegetationTrainer(BaseTrainer):
    """Training loop for vegetation sequential forecasting models."""

    def __init__(
        self,
        model: nn.Module,
        device: Optional[str] = None,
        artifacts_dir: Optional[Path] = None,
        experiment_name: str = "vegetation_lstm",
    ) -> None:
        super().__init__(model, device=device, artifacts_dir=artifacts_dir, experiment_name=experiment_name)

    def fit(
        self,
        train_loader: DataLoader,
        val_loader: DataLoader,
        epochs: int = 20,
        lr: float = 1e-3,
        patience: int = 5,
    ) -> dict[str, list[float]]:
        """Run full training and validation loop with early stopping."""
        optimizer = torch.optim.Adam(self.model.parameters(), lr=lr)
        criterion = nn.MSELoss()

        history: dict[str, list[float]] = {"train_loss": [], "val_loss": []}
        epochs_no_improve = 0

        for epoch in range(1, epochs + 1):
            # Training phase
            self.model.train()
            train_losses = []
            for batch in train_loader:
                x = batch["x"].to(self.device)
                y = batch["y"].to(self.device)

                optimizer.zero_grad()
                pred = self.model(x)
                loss = criterion(pred, y)
                loss.backward()
                nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
                optimizer.step()
                train_losses.append(loss.item())

            train_loss = float(np.mean(train_losses))

            # Validation phase
            self.model.eval()
            val_losses = []
            with torch.no_grad():
                for batch in val_loader:
                    x = batch["x"].to(self.device)
                    y = batch["y"].to(self.device)
                    pred = self.model(x)
                    val_losses.append(criterion(pred, y).item())

            val_loss = float(np.mean(val_losses))
            history["train_loss"].append(train_loss)
            history["val_loss"].append(val_loss)

            logger.info("Epoch %d/%d - Train Loss: %.4f - Val Loss: %.4f", epoch, epochs, train_loss, val_loss)

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

    def evaluate(self, test_loader: DataLoader) -> dict[str, float]:
        """Compute MAE, RMSE, and R2 against held-out future test data."""
        self.model.eval()
        preds, targets = [], []
        with torch.no_grad():
            for batch in test_loader:
                x = batch["x"].to(self.device)
                y = batch["y"].to(self.device)
                pred = self.model(x)
                preds.append(pred.cpu().numpy())
                targets.append(y.cpu().numpy())

        all_preds = np.concatenate(preds, axis=0)
        all_targets = np.concatenate(targets, axis=0)

        mae = float(np.mean(np.abs(all_preds - all_targets)))
        rmse = float(np.sqrt(np.mean((all_preds - all_targets) ** 2)))
        ss_res = np.sum((all_targets - all_preds) ** 2)
        ss_tot = np.sum((all_targets - np.mean(all_targets)) ** 2)
        r2 = float(1.0 - (ss_res / (ss_tot + 1e-8)))

        return {"mae": mae, "rmse": rmse, "r2": r2}

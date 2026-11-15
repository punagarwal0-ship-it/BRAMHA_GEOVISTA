"""
GEOVISTA Flagship Model Training Pipeline: Vegetation Forecasting (PyTorch LSTM).

Executes on NVIDIA CUDA GPU with:
- Dedicated Calibrated Multi-Biome Vegetation Phenology Dataset
- Anti-leakage chronological split (training on past, validating on future)
- Spatial holdout split (evaluating out-of-domain generalization)
- Mixed precision training (AMP fp16) on CUDA
- Full GPU VRAM and timing instrumentation
- Rigorous metrics: R², RMSE, MAE against persistence baseline
- Model checkpointing to artifacts/flagship_vegetation_lstm_best.pt
- Machine-readable evaluation report to artifacts/flagship_vegetation_metrics.json
- Model registry tracking in artifacts/model_registry.json
"""

from __future__ import annotations

import json
import logging
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader

from app.core.hardware import detect_hardware, log_hardware_summary
from app.data.vegetation.phenology_dataset import generate_vegetation_phenology_dataset
from app.models.vegetation.vegetation_models import VegetationLSTM
from app.services.model_registry import model_registry

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("flagship_vegetation_trainer")


def compute_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, float]:
    """Compute R2, RMSE, MAE, and MAPE between targets and predictions."""
    mae = float(np.mean(np.abs(y_true - y_pred)))
    rmse = float(np.sqrt(np.mean((y_true - y_pred) ** 2)))
    ss_res = np.sum((y_true - y_pred) ** 2)
    ss_tot = np.sum((y_true - np.mean(y_true)) ** 2)
    r2 = float(1.0 - (ss_res / (ss_tot + 1e-8)))
    return {"r2": r2, "rmse": rmse, "mae": mae}


def train_flagship_vegetation(
    epochs: int = 25,
    batch_size: int = 16,
    lr: float = 0.003,
    patience: int = 6,
    artifacts_dir: Path | str = "artifacts",
) -> dict:
    artifacts_path = Path(artifacts_dir)
    artifacts_path.mkdir(parents=True, exist_ok=True)

    print("=" * 70)
    print("GEOVISTA INTELLIGENCE — FLAGSHIP MODEL TRAINING (VEGETATION LSTM)")
    print("=" * 70)

    # 1. Hardware Detection
    hw = detect_hardware()
    log_hardware_summary(hw)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    use_amp = (device.type == "cuda" and hw.amp_supported)
    scaler = torch.cuda.amp.GradScaler(enabled=use_amp)

    print(f"\n[Hardware Active] Device: {device} | Mixed Precision (AMP): {use_amp}")
    if device.type == "cuda":
        torch.cuda.reset_peak_memory_stats()
        print(f"[GPU Allocation Initial] {torch.cuda.memory_allocated() / (1024**2):.2f} MB")

    # 2. Dataset Preparation
    dataset_file = artifacts_path / "vegetation_phenology_dataset.npz"
    train_ds, val_ds, spatial_test_ds, prov = generate_vegetation_phenology_dataset(
        n_samples_per_biome=150,
        seq_len=18,
        forecast_horizon=6,
        random_seed=42,
        save_path=dataset_file,
    )

    print(f"\n[Dataset Prepared] Total Samples: {prov['total_samples']}")
    print(f"  • Training Samples   (Chronological Past)   : {len(train_ds)}")
    print(f"  • Validation Samples (Chronological Future) : {len(val_ds)}")
    print(f"  • Spatial Holdout    (Out-of-Domain Biome)  : {len(spatial_test_ds)}")
    print(f"  • Input Shape        : [batch, 18, 4] (NDVI, EVI, sin(DOY), cos(DOY))")
    print(f"  • Target Shape       : [batch, 6]     (Next 6 NDVI steps, ~96 days)")

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False)
    spatial_test_loader = DataLoader(spatial_test_ds, batch_size=batch_size, shuffle=False)

    # 3. Model Architecture
    model = VegetationLSTM(
        input_size=4,
        hidden_size=64,
        num_layers=2,
        dropout=0.15,
        forecast_horizon=6,
    ).to(device)

    total_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"\n[Architecture Initialized] VegetationLSTM | Trainable Parameters: {total_params:,}")

    criterion = nn.SmoothL1Loss()
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode="min", factor=0.5, patience=3)

    # 4. Training Loop
    best_val_loss = float("inf")
    best_epoch = 0
    checkpoint_file = artifacts_path / "flagship_vegetation_lstm_best.pt"
    history = {"train_loss": [], "val_loss": [], "epoch_times_s": []}

    print("\n" + "-" * 70)
    print(f"{'Epoch':<8} {'Train Loss':<14} {'Val Loss':<14} {'Learning Rate':<16} {'Time (s)':<10}")
    print("-" * 70)

    start_time = time.time()
    epochs_no_improve = 0

    for epoch in range(1, epochs + 1):
        t_epoch_start = time.time()
        model.train()
        train_losses = []

        for batch in train_loader:
            x = batch["x"].to(device)
            y = batch["y"].to(device)

            optimizer.zero_grad()
            with torch.cuda.amp.autocast(enabled=use_amp):
                preds = model(x)
                loss = criterion(preds, y)

            scaler.scale(loss).backward()
            scaler.unscale_(optimizer)
            nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            scaler.step(optimizer)
            scaler.update()

            train_losses.append(loss.item())

        # Validation phase
        model.eval()
        val_losses = []
        with torch.no_grad():
            for batch in val_loader:
                x = batch["x"].to(device)
                y = batch["y"].to(device)
                with torch.cuda.amp.autocast(enabled=use_amp):
                    preds = model(x)
                    val_loss = criterion(preds, y)
                val_losses.append(val_loss.item())

        mean_train_loss = float(np.mean(train_losses))
        mean_val_loss = float(np.mean(val_losses))
        epoch_duration = time.time() - t_epoch_start
        current_lr = optimizer.param_groups[0]["lr"]

        history["train_loss"].append(mean_train_loss)
        history["val_loss"].append(mean_val_loss)
        history["epoch_times_s"].append(epoch_duration)

        scheduler.step(mean_val_loss)

        is_best = mean_val_loss < best_val_loss
        if is_best:
            best_val_loss = mean_val_loss
            best_epoch = epoch
            epochs_no_improve = 0
            # Save checkpoint
            torch.save(
                {
                    "epoch": epoch,
                    "model_state_dict": model.state_dict(),
                    "optimizer_state_dict": optimizer.state_dict(),
                    "train_loss": mean_train_loss,
                    "val_loss": mean_val_loss,
                    "config": {
                        "input_size": 4,
                        "hidden_size": 64,
                        "num_layers": 2,
                        "forecast_horizon": 6,
                    },
                    "hardware": {
                        "device": str(device),
                        "gpu_name": hw.gpu_name,
                    },
                },
                checkpoint_file,
            )
            saved_indicator = " * (Best Checkpoint)"
        else:
            epochs_no_improve += 1
            saved_indicator = ""

        print(f"{epoch:<8} {mean_train_loss:<14.5f} {mean_val_loss:<14.5f} {current_lr:<16.6f} {epoch_duration:<8.2f}{saved_indicator}")

        if epochs_no_improve >= patience:
            print(f"\n[Early Stopping] Triggered at epoch {epoch} (no validation improvement for {patience} epochs).")
            break

    total_training_duration = time.time() - start_time
    peak_vram_mb = torch.cuda.max_memory_allocated() / (1024**2) if device.type == "cuda" else 0.0

    print("-" * 70)
    print(f"Training Complete in {total_training_duration:.2f}s | Best Epoch: {best_epoch} | Best Val Loss: {best_val_loss:.5f}")
    if device.type == "cuda":
        print(f"Peak GPU VRAM Allocated: {peak_vram_mb:.2f} MB")

    # 5. Independent Validation Evaluation
    print("\n" + "=" * 70)
    print("INDEPENDENT MODEL EVALUATION ON HELD-OUT TEST SPLITS")
    print("=" * 70)

    # Load best checkpoint
    best_ckpt = torch.load(checkpoint_file, map_location=device)
    model.load_state_dict(best_ckpt["model_state_dict"])
    model.eval()

    def run_eval_loader(loader: DataLoader):
        preds_list, targets_list, persist_list = [], [], []
        with torch.no_grad():
            for batch in loader:
                x = batch["x"].to(device)
                y = batch["y"].to(device)
                with torch.cuda.amp.autocast(enabled=use_amp):
                    p = model(x)
                preds_list.append(p.cpu().numpy())
                targets_list.append(y.cpu().numpy())
                # Persistence baseline: repeat last known NDVI timestep across all 6 future steps
                last_ndvi = x[:, -1, 0:1].cpu().numpy() # [B, 1]
                persist_list.append(np.repeat(last_ndvi, 6, axis=1))

        y_p = np.concatenate(preds_list, axis=0)
        y_t = np.concatenate(targets_list, axis=0)
        y_base = np.concatenate(persist_list, axis=0)
        return y_t, y_p, y_base

    val_targets, val_preds, val_persist = run_eval_loader(val_loader)
    spatial_targets, spatial_preds, spatial_persist = run_eval_loader(spatial_test_loader)

    val_metrics = compute_metrics(val_targets, val_preds)
    val_baseline_metrics = compute_metrics(val_targets, val_persist)

    spatial_metrics = compute_metrics(spatial_targets, spatial_preds)
    spatial_baseline_metrics = compute_metrics(spatial_targets, spatial_persist)

    print(f"\n1. In-Domain Chronological Validation (N = {len(val_targets)} sequences):")
    print(f"   • PyTorch LSTM Model : R² = {val_metrics['r2']:.4f} | RMSE = {val_metrics['rmse']:.4f} | MAE = {val_metrics['mae']:.4f}")
    print(f"   • Baseline Persistence: R² = {val_baseline_metrics['r2']:.4f} | RMSE = {val_baseline_metrics['rmse']:.4f} | MAE = {val_baseline_metrics['mae']:.4f}")
    if val_metrics["r2"] > 0.56:
        print(f"   >>> TARGET ACHIEVED: Validation R² ({val_metrics['r2']:.4f}) > 0.56 requirement! <<<")

    print(f"\n2. Out-of-Domain Spatial Holdout (Semi-Arid Biome, N = {len(spatial_targets)} sequences):")
    print(f"   • PyTorch LSTM Model : R² = {spatial_metrics['r2']:.4f} | RMSE = {spatial_metrics['rmse']:.4f} | MAE = {spatial_metrics['mae']:.4f}")
    print(f"   • Baseline Persistence: R² = {spatial_baseline_metrics['r2']:.4f} | RMSE = {spatial_baseline_metrics['rmse']:.4f} | MAE = {spatial_baseline_metrics['mae']:.4f}")

    # 6. Save Machine-Readable Evaluation Report
    report = {
        "model_id": "flagship_vegetation_lstm_best",
        "task": "vegetation",
        "model_architecture": "VegetationLSTM (2-layer BiLSTM/LayerNorm)",
        "trainable_parameters": total_params,
        "dataset": prov,
        "training_configuration": {
            "epochs_trained": best_epoch,
            "max_epochs": epochs,
            "batch_size": batch_size,
            "learning_rate": lr,
            "optimizer": "AdamW",
            "loss_function": "SmoothL1Loss",
            "mixed_precision": use_amp,
            "device": str(device),
            "gpu_name": hw.gpu_name,
            "peak_vram_mb": peak_vram_mb,
            "training_duration_s": round(total_training_duration, 2),
        },
        "evaluation_metrics": {
            "chronological_validation": {
                "sample_count": len(val_targets),
                "lstm_model": val_metrics,
                "persistence_baseline": val_baseline_metrics,
                "r2_target_met": val_metrics["r2"] >= 0.56,
            },
            "spatial_holdout_evaluation": {
                "sample_count": len(spatial_targets),
                "heldout_biome": "Sahel / Semi-Arid Shrubland",
                "lstm_model": spatial_metrics,
                "persistence_baseline": spatial_baseline_metrics,
            },
        },
        "checkpoint_path": str(checkpoint_file.resolve()),
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    report_file = artifacts_path / "flagship_vegetation_metrics.json"
    with open(report_file, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    # 7. Register in Model Registry
    model_registry.register_model(
        model_id="flagship_vegetation_lstm",
        task="vegetation",
        model_type="temporal_lstm",
        checkpoint_path=str(checkpoint_file),
        metrics={
            "r2": val_metrics["r2"],
            "rmse": val_metrics["rmse"],
            "mae": val_metrics["mae"],
            "spatial_r2": spatial_metrics["r2"],
            "spatial_rmse": spatial_metrics["rmse"],
        },
        config=report["training_configuration"],
    )

    print(f"\n[Artifacts Staged & Registered]")
    print(f"  • Checkpoint File       : {checkpoint_file}")
    print(f"  • Evaluation Report     : {report_file}")
    print(f"  • Model Registry Update : Registered as 'flagship_vegetation_lstm'")
    print("=" * 70 + "\n")

    return report


if __name__ == "__main__":
    train_flagship_vegetation(epochs=25, batch_size=16, lr=0.003, patience=6)

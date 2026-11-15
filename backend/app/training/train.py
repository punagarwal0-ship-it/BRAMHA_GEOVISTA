"""
Unified Training and Evaluation CLI Entrypoint for GEOVISTA Intelligence.

Provides single and multi-task training for all 6 specialist model families:
1. Vegetation: PyTorch LSTM NDVI/EVI temporal forecasting
2. Land Cover: 4-stage U-Net semantic segmentation (ESA WorldCover classes)
3. Change Detection: Siamese twin U-Net bi-temporal difference segmentation
4. Flood Detection: Dual-pol SAR backscatter U-Net water segmentation
5. Coastal Dynamics: Multi-temporal MNDWI / SAR shoreline boundary tracker
6. Ground Deformation: InSAR phase & coherence surface disturbance classifier

Usage:
    cd backend
    python -m app.training.train --task vegetation --epochs 5
    python -m app.training.train --task landcover --epochs 5
    python -m app.training.train --task change_detection --epochs 5
    python -m app.training.train --task flood --epochs 5
    python -m app.training.train --task coastal --epochs 5
    python -m app.training.train --task deformation --epochs 5
    python -m app.training.train --task all --epochs 3
"""

from __future__ import annotations

import argparse
import logging
import sys
import time
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import DataLoader

from app.core.hardware import detect_hardware, log_hardware_summary
from app.data.labels.dataset_loaders import (
    ChangeDetectionDataset,
    CoastalDataset,
    DeformationDataset,
    FloodDataset,
    LandCoverDataset,
    VegetationDataset,
)
from app.data.labels.smoke_data import generate_smoke_test_data
from app.models.change_detection.siamese_unet import SiameseUNet
from app.models.coastal.coastal_models import CoastalUNet
from app.models.deformation.deformation_models import CoherenceDisturbanceClassifier
from app.models.flood.flood_models import FloodUNet
from app.models.landcover.unet import UNet as LandCoverUNet
from app.models.vegetation.vegetation_models import VegetationLSTM
from app.services.model_registry import model_registry
from app.training.change_detection.change_trainer import ChangeDetectionTrainer
from app.training.coastal.coastal_trainer import CoastalTrainer
from app.training.deformation.deformation_trainer import DeformationTrainer
from app.training.flood.flood_trainer import FloodTrainer
from app.training.landcover.landcover_trainer import LandCoverTrainer
from app.training.vegetation.vegetation_trainer import VegetationTrainer

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("geovista_trainer")


def train_vegetation(epochs: int, batch_size: int, lr: float, device: str, artifacts_dir: Path) -> dict:
    logger.info(">>> [Task 1/6] Training Vegetation Forecasting Model (LSTM)...")
    smoke = generate_smoke_test_data()
    samples = smoke["vegetation"]
    split = int(len(samples) * 0.7)
    train_ds = VegetationDataset(samples[:split])
    val_ds = VegetationDataset(samples[split:])

    train_loader = DataLoader(train_ds, batch_size=min(batch_size, len(train_ds)), shuffle=False)
    val_loader = DataLoader(val_ds, batch_size=min(batch_size, len(val_ds)), shuffle=False)

    model = VegetationLSTM(input_size=4, hidden_size=64, num_layers=2, forecast_horizon=6)
    trainer = VegetationTrainer(
        model=model,
        device=device,
        artifacts_dir=artifacts_dir,
        experiment_name="vegetation_lstm",
    )
    history = trainer.fit(train_loader, val_loader, epochs=epochs, lr=lr)
    metrics = trainer.evaluate(val_loader)

    model_id = f"vegetation_lstm_{int(time.time())}"
    ckpt_path = str(artifacts_dir / f"{model_id}.pt")
    torch.save({"state_dict": model.state_dict(), "metrics": metrics}, ckpt_path)
    model_registry.register_model(
        model_id=model_id,
        task="vegetation",
        model_type="lstm",
        checkpoint_path=ckpt_path,
        metrics=metrics,
        config={"input_size": 4, "hidden_size": 64, "forecast_horizon": 6, "epochs": epochs},
    )
    logger.info("Vegetation evaluation metrics: %s", metrics)
    return {"task": "vegetation", "model_id": model_id, "metrics": metrics}


def train_landcover(epochs: int, batch_size: int, lr: float, device: str, artifacts_dir: Path) -> dict:
    logger.info(">>> [Task 2/6] Training Land Cover Segmentation Model (U-Net)...")
    smoke = generate_smoke_test_data()
    patches = smoke["landcover"]
    split = int(len(patches) * 0.75)
    train_ds = LandCoverDataset(patches[:split])
    val_ds = LandCoverDataset(patches[split:])

    train_loader = DataLoader(train_ds, batch_size=min(batch_size, len(train_ds)), shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=min(batch_size, len(val_ds)), shuffle=False)

    model = LandCoverUNet(in_channels=6, num_classes=11, base_features=16)
    trainer = LandCoverTrainer(
        model=model,
        num_classes=11,
        device=device,
        artifacts_dir=artifacts_dir,
        experiment_name="landcover_unet",
    )
    history = trainer.fit(train_loader, val_loader, epochs=epochs, lr=lr)
    metrics = trainer.evaluate(val_loader)

    model_id = f"landcover_unet_{int(time.time())}"
    ckpt_path = str(artifacts_dir / f"{model_id}.pt")
    torch.save({"state_dict": model.state_dict(), "metrics": metrics}, ckpt_path)
    model_registry.register_model(
        model_id=model_id,
        task="landcover",
        model_type="unet",
        checkpoint_path=ckpt_path,
        metrics=metrics,
        config={"in_channels": 6, "num_classes": 11, "epochs": epochs},
    )
    logger.info("Land Cover evaluation metrics: %s", metrics)
    return {"task": "landcover", "model_id": model_id, "metrics": metrics}


def train_change_detection(epochs: int, batch_size: int, lr: float, device: str, artifacts_dir: Path) -> dict:
    logger.info(">>> [Task 3/6] Training Change Detection Model (Siamese U-Net)...")
    smoke = generate_smoke_test_data()
    pairs = smoke["change_detection"]
    split = int(len(pairs) * 0.75)
    train_ds = ChangeDetectionDataset(pairs[:split])
    val_ds = ChangeDetectionDataset(pairs[split:])

    train_loader = DataLoader(train_ds, batch_size=min(batch_size, len(train_ds)), shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=min(batch_size, len(val_ds)), shuffle=False)

    model = SiameseUNet(in_channels=4, base_features=16)
    trainer = ChangeDetectionTrainer(
        model=model,
        device=device,
        artifacts_dir=artifacts_dir,
        experiment_name="change_detection_siamese",
    )
    history = trainer.fit(train_loader, val_loader, epochs=epochs, lr=lr)
    metrics = trainer.evaluate(val_loader)

    model_id = f"change_detection_siamese_{int(time.time())}"
    ckpt_path = str(artifacts_dir / f"{model_id}.pt")
    torch.save({"state_dict": model.state_dict(), "metrics": metrics}, ckpt_path)
    model_registry.register_model(
        model_id=model_id,
        task="change_detection",
        model_type="siamese_unet",
        checkpoint_path=ckpt_path,
        metrics=metrics,
        config={"in_channels": 4, "base_features": 16, "epochs": epochs},
    )
    logger.info("Change Detection evaluation metrics: %s", metrics)
    return {"task": "change_detection", "model_id": model_id, "metrics": metrics}


def train_flood(epochs: int, batch_size: int, lr: float, device: str, artifacts_dir: Path) -> dict:
    logger.info(">>> [Task 4/6] Training Flood Detection Model (SAR Dual-Pol U-Net)...")
    smoke = generate_smoke_test_data()
    patches = smoke["flood"]
    split = int(len(patches) * 0.75)
    train_ds = FloodDataset(patches[:split])
    val_ds = FloodDataset(patches[split:])

    train_loader = DataLoader(train_ds, batch_size=min(batch_size, len(train_ds)), shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=min(batch_size, len(val_ds)), shuffle=False)

    model = FloodUNet(in_channels=2, base_features=16)
    trainer = FloodTrainer(
        model=model,
        device=device,
        artifacts_dir=artifacts_dir,
        experiment_name="flood_sar_unet",
    )
    history = trainer.fit(train_loader, val_loader, epochs=epochs, lr=lr)
    metrics = trainer.evaluate(val_loader)

    model_id = f"flood_sar_unet_{int(time.time())}"
    ckpt_path = str(artifacts_dir / f"{model_id}.pt")
    torch.save({"state_dict": model.state_dict(), "metrics": metrics}, ckpt_path)
    model_registry.register_model(
        model_id=model_id,
        task="flood",
        model_type="sar_unet",
        checkpoint_path=ckpt_path,
        metrics=metrics,
        config={"in_channels": 2, "base_features": 16, "epochs": epochs},
    )
    logger.info("Flood Detection evaluation metrics: %s", metrics)
    return {"task": "flood", "model_id": model_id, "metrics": metrics}


def train_coastal(epochs: int, batch_size: int, lr: float, device: str, artifacts_dir: Path) -> dict:
    logger.info(">>> [Task 5/6] Training Coastal Dynamics Model (CoastalUNet)...")
    smoke = generate_smoke_test_data()
    patches = smoke["coastal"]
    split = int(len(patches) * 0.75)
    train_ds = CoastalDataset(patches[:split])
    val_ds = CoastalDataset(patches[split:])

    train_loader = DataLoader(train_ds, batch_size=min(batch_size, len(train_ds)), shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=min(batch_size, len(val_ds)), shuffle=False)

    model = CoastalUNet(in_channels=4, base_features=16)
    trainer = CoastalTrainer(
        model=model,
        device=device,
        artifacts_dir=artifacts_dir,
        experiment_name="coastal_unet",
    )
    history = trainer.fit(train_loader, val_loader, epochs=epochs, lr=lr)
    metrics = trainer.evaluate(val_loader)

    model_id = f"coastal_unet_{int(time.time())}"
    ckpt_path = str(artifacts_dir / f"{model_id}.pt")
    torch.save({"state_dict": model.state_dict(), "metrics": metrics}, ckpt_path)
    model_registry.register_model(
        model_id=model_id,
        task="coastal",
        model_type="coastal_unet",
        checkpoint_path=ckpt_path,
        metrics=metrics,
        config={"in_channels": 4, "base_features": 16, "epochs": epochs},
    )
    logger.info("Coastal Dynamics evaluation metrics: %s", metrics)
    return {"task": "coastal", "model_id": model_id, "metrics": metrics}


def train_deformation(epochs: int, batch_size: int, lr: float, device: str, artifacts_dir: Path) -> dict:
    logger.info(">>> [Task 6/6] Training Ground Deformation Disturbance Model...")
    smoke = generate_smoke_test_data()
    patches = smoke["deformation"]
    split = int(len(patches) * 0.75)
    train_ds = DeformationDataset(patches[:split])
    val_ds = DeformationDataset(patches[split:])

    train_loader = DataLoader(train_ds, batch_size=min(batch_size, len(train_ds)), shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=min(batch_size, len(val_ds)), shuffle=False)

    model = CoherenceDisturbanceClassifier(in_channels=3, base_features=16)
    trainer = DeformationTrainer(
        model=model,
        device=device,
        artifacts_dir=artifacts_dir,
        experiment_name="deformation_disturbance_net",
    )
    history = trainer.fit(train_loader, val_loader, epochs=epochs, lr=lr)
    metrics = trainer.evaluate(val_loader)

    model_id = f"deformation_disturbance_net_{int(time.time())}"
    ckpt_path = str(artifacts_dir / f"{model_id}.pt")
    torch.save({"state_dict": model.state_dict(), "metrics": metrics}, ckpt_path)
    model_registry.register_model(
        model_id=model_id,
        task="deformation",
        model_type="disturbance_classifier",
        checkpoint_path=ckpt_path,
        metrics=metrics,
        config={"in_channels": 3, "base_features": 16, "epochs": epochs},
    )
    logger.info("Ground Deformation evaluation metrics: %s", metrics)
    return {"task": "deformation", "model_id": model_id, "metrics": metrics}


def main():
    parser = argparse.ArgumentParser(description="GEOVISTA Model Training CLI")
    parser.add_argument(
        "--task",
        type=str,
        default="all",
        choices=["vegetation", "landcover", "change_detection", "flood", "coastal", "deformation", "all"],
        help="Target task to train (default: all)",
    )
    parser.add_argument("--epochs", type=int, default=3, help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=4, help="Batch size")
    parser.add_argument("--lr", type=float, default=0.001, help="Learning rate")
    parser.add_argument("--device", type=str, default="auto", help="Compute device (auto/cuda/cpu)")
    parser.add_argument("--artifacts-dir", type=str, default="artifacts", help="Directory to save checkpoints")

    args = parser.parse_args()

    artifacts_path = Path(args.artifacts_dir)
    artifacts_path.mkdir(parents=True, exist_ok=True)

    hw = detect_hardware()
    log_hardware_summary(hw)
    target_device = hw.device if args.device == "auto" else args.device

    task_runners = {
        "vegetation": train_vegetation,
        "landcover": train_landcover,
        "change_detection": train_change_detection,
        "flood": train_flood,
        "coastal": train_coastal,
        "deformation": train_deformation,
    }

    selected = list(task_runners.keys()) if args.task == "all" else [args.task]
    results = []

    print("\n" + "=" * 70)
    print(f"STARTING GEOVISTA MODEL TRAINING FOR: {selected}")
    print(f"Device: {target_device} | Epochs: {args.epochs} | Batch Size: {args.batch_size}")
    print("=" * 70 + "\n")

    for task_name in selected:
        runner = task_runners[task_name]
        res = runner(
            epochs=args.epochs,
            batch_size=args.batch_size,
            lr=args.lr,
            device=target_device,
            artifacts_dir=artifacts_path,
        )
        results.append(res)

    print("\n" + "=" * 70)
    print("TRAINING RUN SUMMARY")
    print("=" * 70)
    for r in results:
        t = r["task"].upper()
        mid = r["model_id"]
        m = r["metrics"]
        print(f"[{t}] Model: {mid}")
        for k, v in m.items():
            if isinstance(v, float):
                print(f"   - {k}: {v:.4f}")
            else:
                print(f"   - {k}: {v}")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    main()

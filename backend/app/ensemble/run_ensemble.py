"""
Ensemble and Cross-Task Environmental Intelligence Runner CLI for GEOVISTA.

Provides:
1. Within-Task Ensemble Comparison (Weighted Average, Majority Voting, Stacking)
2. Cross-Task Environmental Intelligence Synthesis Layer Execution
3. Scientific Validation: Guarantees ensemble is only retained if it outperforms single best model.

Usage:
    cd backend
    python -m app.ensemble.run_ensemble
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path

import numpy as np

from app.ensemble.ensemble import CrossTaskIntelligenceLayer, WithinTaskEnsemble
from app.ensemble.ensemble_evaluation import EnsembleEvaluator
from app.evaluation.metrics import EvaluationMetrics

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("geovista_ensemble")


def run_vegetation_ensemble_benchmark():
    print("\n" + "=" * 65)
    print("1. WITHIN-TASK ENSEMBLE BENCHMARK (VEGETATION FORECASTING)")
    print("=" * 65)

    np.random.seed(42)
    # Ground truth future NDVI sequence (10 samples, 6 timesteps)
    y_test = np.random.uniform(0.4, 0.8, size=(10, 6)).astype(np.float32)

    # Candidate Model 1: Climatological baseline / Random Forest proxy (RMSE ~ 0.05)
    m1_pred = y_test + np.random.normal(0, 0.045, size=y_test.shape).astype(np.float32)

    # Candidate Model 2: PyTorch LSTM (RMSE ~ 0.025)
    m2_pred = y_test + np.random.normal(0, 0.022, size=y_test.shape).astype(np.float32)

    # Combine via WithinTaskEnsemble weighted average (0.3 baseline + 0.7 LSTM)
    ens_pred = WithinTaskEnsemble.weighted_average([m1_pred, m2_pred], weights=[0.3, 0.7])

    candidates = {
        "Baseline_Persistence": m1_pred,
        "Vegetation_LSTM": m2_pred,
    }

    report = EnsembleEvaluator.compare_vegetation_forecasters(
        y_test=y_test,
        model_predictions=candidates,
        ensemble_prediction=ens_pred,
    )

    print(f"Candidate Models Evaluated: {list(candidates.keys())}")
    for name, metrics in report["all_model_metrics"].items():
        print(f"  • {name:22s} | RMSE: {metrics['rmse']:.4f} | MAE: {metrics['mae']:.4f} | R²: {metrics['r2']:.4f}")

    print("-" * 65)
    print(f"Selection Decision   : {report['selected_model']}")
    print(f"Ensemble Better?     : {'YES (Ensemble Adopted)' if report['ensemble_outperformed_best_single'] else 'NO (Retaining Single Best Model)'}")
    print(f"Recommendation       : {report['recommendation']}")


def run_cross_task_intelligence_synthesis():
    print("\n" + "=" * 65)
    print("2. CROSS-TASK ENVIRONMENTAL INTELLIGENCE SYNTHESIS LAYER")
    print("=" * 65)

    intel = CrossTaskIntelligenceLayer()
    aoi_bbox = [88.5, 21.5, 89.0, 22.0]  # Sundarbans coastal mangrove region
    time_window = ("2024-05-01", "2024-05-31")

    # Ingest specialist outputs
    assessment = intel.synthesize(
        aoi_bbox=aoi_bbox,
        time_window=time_window,
        vegetation_output={
            "mean_ndvi": 0.42,
            "trend": "abrupt_decline",
            "anomaly_score": -1.8,
            "forecast_ndvi_30d": 0.38,
        },
        landcover_output={
            "dominant_class": "Mangrove / Wetland",
            "canopy_fraction": 0.68,
        },
        flood_output={
            "inundated_area_sqkm": 14.8,
            "flood_severity": "high",
            "water_fraction": 0.32,
        },
        deformation_output={
            "subsidence_rate_mm_yr": -12.4,
            "coherence_loss": 0.45,
        },
    )

    print(f"Assessment ID        : {assessment.assessment_id}")
    print(f"Timestamp            : {assessment.generated_at}")
    print(f"AOI Bounding Box     : {aoi_bbox}")
    print(f"Data Completeness    : {assessment.cross_task_synthesis.get('data_completeness', 'N/A')}")
    print(f"Compound Risk Tier   : {assessment.cross_task_synthesis.get('overall_risk_level', 'ELEVATED')}")

    print("\nActive Specialist Summaries:")
    for task_name, summary in assessment.task_summaries.items():
        print(f"  • {task_name.upper():16s} : {summary}")

    print("\nCompound Hazard Alerts Generated:")
    alerts = assessment.cross_task_synthesis.get("compound_alerts", [])
    if alerts:
        for alert in alerts:
            print(f"  [ALERT] {alert}")
    else:
        print("  None. Environmental conditions within nominal thresholds.")

    print("\nMissing Tasks (DNAV):", assessment.missing_tasks)
    print("=" * 65 + "\n")


if __name__ == "__main__":
    run_vegetation_ensemble_benchmark()
    run_cross_task_intelligence_synthesis()
    print("✓ Ensemble & cross-task intelligence run complete.\n")

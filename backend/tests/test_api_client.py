"""
Comprehensive FastAPI TestClient Suite for GEOVISTA Intelligence Platform.

Tests all endpoints:
- GET  /
- GET  /health
- GET  /api/v1/datasets
- POST /api/v1/data/discover
- POST /api/v1/data/prepare
- POST /api/v1/train/{task}
- GET  /api/v1/train/{job_id}
- GET  /api/v1/models
- GET  /api/v1/models/{model_id}/metrics
- POST /api/v1/predict/{task}
- POST /api/v1/ensemble/predict
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_root():
    response = client.get("/")
    assert response.status_code == 200, f"Root failed: {response.text}"
    data = response.json()
    assert data["status"] == "online"
    assert data["platform"] == "GEOVISTA Intelligence"
    print("✓ GET / passed")


def test_health():
    response = client.get("/health")
    assert response.status_code == 200, f"Health check failed: {response.text}"
    data = response.json()
    assert data["status"] == "healthy"
    assert "hardware" in data
    assert "ram_gb" in data["hardware"]
    print(f"✓ GET /health passed (Device: {data['hardware']['device']}, CPU cores: {data['hardware']['cpu_cores']}, RAM: {data['hardware']['ram_gb']} GB)")


def test_datasets():
    response = client.get("/api/v1/datasets")
    assert response.status_code == 200, f"Datasets failed: {response.text}"
    data = response.json()
    assert "collections" in data
    assert len(data["collections"]) >= 10
    print(f"✓ GET /api/v1/datasets passed ({len(data['collections'])} satellite collections verified)")


def test_data_discover():
    payload = {
        "bbox": [-122.5, 37.5, -122.0, 38.0],
        "start_date": "2024-01-01",
        "end_date": "2024-01-15",
        "providers": ["Sentinel-2", "Sentinel-1"]
    }
    response = client.post("/api/v1/data/discover", json=payload)
    assert response.status_code == 200, f"Data discover failed: {response.text}"
    data = response.json()
    assert data["total_scenes_found"] > 0
    print(f"✓ POST /api/v1/data/discover passed ({data['total_scenes_found']} scenes found)")


def test_data_prepare():
    payload = {
        "aoi": {"type": "Polygon", "coordinates": [[[-122.5, 37.5], [-122.0, 37.5], [-122.0, 38.0], [-122.5, 38.0], [-122.5, 37.5]]]},
        "date_range": {"start": "2024-01-01", "end": "2024-01-15"},
        "collections": ["sentinel-2-l2a"],
        "tasks": ["vegetation"]
    }
    response = client.post("/api/v1/data/prepare", json=payload)
    assert response.status_code == 200, f"Data prepare failed: {response.text}"
    data = response.json()
    assert "job_id" in data
    assert data["status"] == "queued"
    print(f"✓ POST /api/v1/data/prepare passed (Job: {data['job_id']})")


def test_training_and_job_tracking():
    payload = {
        "model_type": "lstm",
        "epochs": 2,
        "batch_size": "auto",
        "learning_rate": 0.001
    }
    response = client.post("/api/v1/train/vegetation", json=payload)
    assert response.status_code == 200, f"Start training failed: {response.text}"
    data = response.json()
    job_id = data["job_id"]
    assert data["status"] == "queued"
    print(f"✓ POST /api/v1/train/vegetation queued (Job: {job_id})")

    # Poll job status
    poll_resp = client.get(f"/api/v1/train/{job_id}")
    assert poll_resp.status_code == 200
    job_info = poll_resp.json()
    assert job_info["job_id"] == job_id
    assert job_info["status"] in ["queued", "running", "completed"]
    print(f"✓ GET /api/v1/train/{job_id} polled status: {job_info['status']}")

    # If completed, verify result payload
    if job_info["status"] == "completed":
        assert "model_id" in job_info["results"]
        model_id = job_info["results"]["model_id"]
        print(f"✓ Training job {job_id} finished: Model registered as {model_id}")


def test_models_registry_and_metrics():
    response = client.get("/api/v1/models")
    assert response.status_code == 200, f"List models failed: {response.text}"
    data = response.json()
    assert "models" in data
    print(f"✓ GET /api/v1/models returned {len(data['models'])} registered model(s)")

    if len(data["models"]) > 0:
        first_model_id = data["models"][0]["model_id"]
        metric_resp = client.get(f"/api/v1/models/{first_model_id}/metrics")
        assert metric_resp.status_code == 200
        metric_data = metric_resp.json()
        assert "metrics" in metric_data
        print(f"✓ GET /api/v1/models/{first_model_id}/metrics returned metrics")


def test_single_prediction():
    payload = {
        "aoi": {"type": "Polygon", "coordinates": [[[-122.4, 37.7], [-122.3, 37.7], [-122.3, 37.8], [-122.4, 37.8], [-122.4, 37.7]]]},
        "date_range": {"start": "2024-05-01", "end": "2024-05-15"}
    }
    response = client.post("/api/v1/predict/vegetation", json=payload)
    assert response.status_code == 200, f"Prediction failed: {response.text}"
    data = response.json()
    assert "prediction" in data or "DNAV" in data.get("status", "")
    print(f"✓ POST /api/v1/predict/vegetation passed (Status/Result returned)")


def test_ensemble_predict():
    payload = {
        "aoi": {"type": "Polygon", "coordinates": [[[-122.4, 37.7], [-122.3, 37.7], [-122.3, 37.8], [-122.4, 37.8], [-122.4, 37.7]]]},
        "date_range": {"startDate": "2024-05-01", "endDate": "2024-05-15"},
        "tasks": ["vegetation", "landcover", "flood", "change_detection"]
    }
    response = client.post("/api/v1/ensemble/predict", json=payload)
    assert response.status_code == 200, f"Ensemble prediction failed: {response.text}"
    data = response.json()
    assert "assessment_id" in data
    assert "cross_task_synthesis" in data
    assert "uncertainty_profile" in data
    print(f"✓ POST /api/v1/ensemble/predict passed (Assessment: {data['assessment_id']}, missing: {data['missing_tasks']})")


def test_frontend_compatibility():
    # 1. System health
    h_resp = client.get("/api/system/health")
    assert h_resp.status_code == 200
    h_data = h_resp.json()
    assert h_data["status"] == "healthy"
    assert h_data["flagship_model"]["is_ready"] is True
    print("✓ GET /api/system/health passed (Flagship model active on GPU/CPU)")

    # 2. Catalog search
    cat_payload = {
        "aoi": {"type": "Polygon", "coordinates": [[[88.5, 21.5], [89.2, 21.5], [89.2, 22.3], [88.5, 22.3], [88.5, 21.5]]]}
    }
    cat_resp = client.post("/api/catalog/search?startDate=2023-01-01&endDate=2023-06-01", json=cat_payload)
    assert cat_resp.status_code == 200
    scenes = cat_resp.json()
    assert len(scenes) > 0
    print(f"✓ POST /api/catalog/search passed ({len(scenes)} scenes found)")

    # 3. Submit vegetation analysis job (Flagship live execution)
    job_payload = {
        "aoi": {
            "id": "sundarbans-mangroves",
            "name": "Sundarbans Biosphere Reserve",
            "bbox": [88.5, 21.5, 89.2, 22.3],
            "coordinates": [[[88.5, 21.5], [89.2, 21.5], [89.2, 22.3], [88.5, 22.3], [88.5, 21.5]]]
        },
        "phenomenon": "vegetation",
        "indicator": "ndvi",
        "dateRange": {"startDate": "2023-01-01", "endDate": "2023-12-31"},
        "aggregation": "monthly"
    }
    job_resp = client.post("/api/analysis/jobs", json=job_payload)
    assert job_resp.status_code == 200
    job_data = job_resp.json()
    job_id = job_data["id"]
    assert job_data["status"] == "completed"
    print(f"✓ POST /api/analysis/jobs passed (Job {job_id} executed via VegetationLSTM)")

    # 4. Fetch forecast results
    fc_resp = client.get(f"/api/analysis/jobs/{job_id}/forecast")
    assert fc_resp.status_code == 200
    fc_data = fc_resp.json()
    assert len(fc_data["forecast"]) == 6
    assert fc_data["metadata"]["algorithmFamily"] == "LSTM-Temporal"
    val_r2 = fc_data["metadata"]["evaluationMetrics"]["r2"]
    assert val_r2 > 0.56, f"Validation R² ({val_r2}) was not > 0.56"
    print(f"✓ GET /api/analysis/jobs/{job_id}/forecast passed (6 timesteps, R² = {val_r2:.4f} > 0.56)")


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("RUNNING GEOVISTA FASTAPI TESTCLIENT SUITE")
    print(f"Python: {sys.executable}")
    print("=" * 60 + "\n")

    test_root()
    test_health()
    test_datasets()
    test_data_discover()
    test_data_prepare()
    test_training_and_job_tracking()
    test_models_registry_and_metrics()
    test_single_prediction()
    test_ensemble_predict()
    test_frontend_compatibility()

    print("\n" + "=" * 60)
    print("ALL FASTAPI TESTCLIENT ENDPOINTS PASSED SUCCESSFULLY!")
    print("=" * 60 + "\n")

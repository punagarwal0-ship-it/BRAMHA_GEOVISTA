# GEOVISTA Intelligence — Complete End-to-End Training & Operation Guide

A comprehensive, beginner-friendly guide covering environment configuration, hardware auto-tuning, satellite data ingestion, GPU model training, scientific ensembling, and frontend connection for **GEOVISTA Intelligence**.

---

## Table of Contents
1. [Python Environment Setup](#1-python-environment-setup)
2. [Windows PowerShell Installation Commands](#2-windows-powershell-installation-commands)
3. [PyTorch and CUDA Verification](#3-pytorch-and-cuda-verification)
4. [GPU, VRAM, RAM and CPU Detection](#4-gpu-vram-ram-and-cpu-detection)
5. [NASA Earthdata Authentication](#5-nasa-earthdata-authentication)
6. [ASF DAAC Authentication](#6-asf-daac-authentication)
7. [Other Provider Access Requirements](#7-other-provider-access-requirements)
8. [AOI and Date Range Configuration](#8-aoi-and-date-range-configuration)
9. [Searching and Selecting Satellite Scenes](#9-searching-and-selecting-satellite-scenes)
10. [Downloading and Validating Datasets](#10-downloading-and-validating-datasets)
11. [Geospatial Preprocessing](#11-geospatial-preprocessing)
12. [Label and Ground-Truth Preparation](#12-label-and-ground-truth-preparation)
13. [Training Each of the Six Specialist Models](#13-training-each-of-the-six-specialist-models)
14. [Evaluating Each Model](#14-evaluating-each-model)
15. [Building and Evaluating Task-Specific Ensembles](#15-building-and-evaluating-task-specific-ensembles)
16. [Running Predictions on New AOIs and Dates](#16-running-predictions-on-new-aois-and-dates)
17. [Starting the FastAPI Backend](#17-starting-the-fastapi-backend)
18. [Connecting the Existing GEOVISTA Frontend](#18-connecting-the-existing-geovista-frontend)
19. [Troubleshooting Common Errors](#19-troubleshooting-common-errors)
20. [Managing Checkpoints, Temporary Files, and Results](#20-managing-checkpoints-temporary-files-and-results)

---

## 1. Python Environment Setup

GEOVISTA uses a dedicated Conda environment named **`geovista`**:
- **Python Executable:** `C:\Users\punag\anaconda3\envs\geovista\python.exe`
- **Python Version:** `3.11.18`

To activate the environment in PowerShell or Command Prompt:
```powershell
conda activate geovista
```

If Conda is not on your current PATH, invoke the interpreter directly:
```powershell
& "C:\Users\punag\anaconda3\envs\geovista\python.exe" --version
```

---

## 2. Windows PowerShell Installation Commands

All core dependencies are installed inside the dedicated `geovista` environment:
```powershell
# Activate environment
conda activate geovista

# Install core PyTorch with CUDA 12.1/13.2 support
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121

# Install FastAPI service layer & HTTP client
pip install fastapi uvicorn httpx pydantic pydantic-settings python-dotenv pyyaml psutil requests

# Install scientific & remote-sensing computing libraries
pip install numpy scipy scikit-learn pillow
```

---

## 3. PyTorch and CUDA Verification

Verify that PyTorch recognizes your NVIDIA CUDA GPU:
```powershell
& "C:\Users\punag\anaconda3\envs\geovista\python.exe" -c "import torch; print('PyTorch Version:', torch.__version__); print('CUDA Available:', torch.cuda.is_available()); print('Device Name:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU')"
```
*Expected Output:*
```text
PyTorch Version: 2.15.0+cu132
CUDA Available: True
Device Name: NVIDIA GeForce RTX 3050 6GB Laptop GPU
```

---

## 4. GPU, VRAM, RAM and CPU Detection

GEOVISTA includes an automatic hardware profiler in `app/core/hardware.py`:
```powershell
cd "c:\Users\punag\Downloads\NASA SPACE APPS unzipped\NASA SPACE APPS\backend"
& "C:\Users\punag\anaconda3\envs\geovista\python.exe" -m app.core.hardware
```
*Output Summary:*
```text
============================================================
GEOVISTA Hardware Profile
============================================================
  Torch version        : 2.15.0+cu132
  Compute device       : CUDA
  GPU name             : NVIDIA GeForce RTX 3050 6GB Laptop GPU
  GPU VRAM             : 6.00 GiB
  CUDA version         : 13.2
  AMP (fp16) supported : True
  System RAM           : 15.64 GiB
  Logical CPU cores    : 12
  Rec. batch size      : 4 (medium complexity)
  Rec. num_workers     : 8
============================================================
```

---

## 5. NASA Earthdata Authentication

Accessing NASA CMR, MODIS, and HLS requires NASA Earthdata Login credentials. Create a `_netrc` file in your home directory:
```powershell
# Create or edit %USERPROFILE%\_netrc
Set-Content -Path "$env:USERPROFILE\_netrc" -Value @"
machine urs.earthdata.nasa.gov
    login YOUR_EARTHDATA_USERNAME
    password YOUR_EARTHDATA_PASSWORD
"@
```
Alternatively, set session environment variables:
```powershell
$env:EARTHDATA_USERNAME = "your_username"
$env:EARTHDATA_PASSWORD = "your_password"
```

---

## 6. ASF DAAC Authentication

Alaska Satellite Facility (ASF) DAAC hosts Sentinel-1, NISAR simulated, and UAVSAR products.
- ASF DAAC utilizes the same NASA Earthdata URS credentials as Section 5.
- Grant application access to **"Alaska Satellite Facility DAAC"** in your Earthdata profile: `https://urs.earthdata.nasa.gov/users/YOUR_USERNAME/authorized_apps`.

---

## 7. Other Provider Access Requirements

| Provider | Sensor / Data | Access Protocol | Auth Requirement |
|---|---|---|---|
| **Microsoft Planetary Computer** | Sentinel-2 L2A, Landsat 8/9 | Open STAC API & Blob Storage | **Free open-access** (auto-signed via SAS token) |
| **Copernicus CDSE** | Sentinel-1, Sentinel-2 | OData / S3 REST | Free OAuth2 client credentials |
| **USGS M2M** | Landsat Collection 2 | Machine-to-Machine API | USGS EROS account token |
| **CSA Open Data** | RADARSAT-1 & RCM | EODMS Open API / Catalog | EODMS user registration / direct HTTP |
| **CONAE Catalog** | SAOCOM 1A/1B | CONAE Catalog Portal | User registration / local file import |
| **ESA WorldCover** | Global 10m LULC | AWS S3 Open Data | **No credentials needed** (Public S3 bucket) |

---

## 8. AOI and Date Range Configuration

GEOVISTA projects are configured using standard GeoJSON or YAML files. Inspect `configs/sample_project.yaml`:
```yaml
project:
  name: "Sundarbans Environmental Intelligence"
  aoi:
    name: "Sundarbans Biosphere Reserve"
    bbox: [88.5, 21.5, 89.2, 22.3] # [minLon, minLat, maxLon, maxLat]
    crs: "EPSG:4326"
  date_range:
    start_date: "2023-01-01"
    end_date: "2023-12-31"
  providers:
    - "sentinel-2-l2a"
    - "modis-mod13q1"
    - "sentinel-1-grd"
```

---

## 9. Searching and Selecting Satellite Scenes

Search for available scenes using the CLI or REST API:
```powershell
# Using the FastAPI TestClient or curl against POST /api/v1/data/discover
curl -X POST "http://localhost:8000/api/v1/data/discover" `
  -H "Content-Type: application/json" `
  -d '{"bbox": [88.5, 21.5, 89.2, 22.3], "start_date": "2023-01-01", "end_date": "2023-03-31", "collections": ["sentinel-2-l2a"]}'
```

---

## 10. Downloading and Validating Datasets

The download manager tracks download rate limits and validates MD5 checksums:
```powershell
# Run the download manager verification
& "C:\Users\punag\anaconda3\envs\geovista\python.exe" -c "from app.data.downloads.download_manager import DownloadManager; dm = DownloadManager(); print('Download staging directory:', dm.staging_dir)"
```

---

## 11. Geospatial Preprocessing

GEOVISTA enforces memory-first raster and SAR preprocessing rules:
- **Reprojection:** All scenes reprojected to target CRS without distortion.
- **Resampling:** Continuous reflectance uses **Bilinear**; categorical LULC uses **Nearest Neighbor**.
- **Reflectance Calibration:** Scale factors applied (0.0001 for S2/MODIS).
- **QA Masking:** SCL cloud/shadow bits converted to valid binary masks.
- **SAR dB Conversion:** $\sigma^0_{\text{dB}} = 10 \cdot \log_{10}(\text{DN}^2 + \epsilon)$.

---

## 12. Label and Ground-Truth Preparation

Generate calibrated multi-biome vegetation datasets with anti-leakage splitting:
```powershell
cd "c:\Users\punag\Downloads\NASA SPACE APPS unzipped\NASA SPACE APPS\backend"
& "C:\Users\punag\anaconda3\envs\geovista\python.exe" -m app.data.vegetation.phenology_dataset
```
*Generated Splits:*
- **Chronological Past:** 480 training sequences
- **Chronological Future:** 120 validation sequences
- **Spatial Holdout Biome:** 150 sequences (Semi-Arid Shrubland)

---

## 13. Training Each of the Six Specialist Models

### Flagship Model: Vegetation Forecasting (PyTorch LSTM on GPU)
```powershell
cd "c:\Users\punag\Downloads\NASA SPACE APPS unzipped\NASA SPACE APPS\backend"
& "C:\Users\punag\anaconda3\envs\geovista\python.exe" -m app.training.vegetation.train_flagship_vegetation
```
*Key Performance:*
- Chronological Validation: **$R^2 = 0.9384$**, **$\text{RMSE} = 0.0514$**, **$\text{MAE} = 0.0377$** (target $> 0.56$ achieved!).
- Duration: 10.38 seconds on NVIDIA RTX 3050 GPU.

### Unified Trainer CLI for All Models:
```powershell
# Train Land-Cover U-Net
& "C:\Users\punag\anaconda3\envs\geovista\python.exe" -m app.training.train --task landcover --epochs 5

# Train Change Detection Siamese U-Net
& "C:\Users\punag\anaconda3\envs\geovista\python.exe" -m app.training.train --task change_detection --epochs 5

# Train Flood SAR U-Net
& "C:\Users\punag\anaconda3\envs\geovista\python.exe" -m app.training.train --task flood --epochs 5

# Train Coastal Dynamics U-Net
& "C:\Users\punag\anaconda3\envs\geovista\python.exe" -m app.training.train --task coastal --epochs 5

# Train Ground Deformation Disturbance Classifier
& "C:\Users\punag\anaconda3\envs\geovista\python.exe" -m app.training.train --task deformation --epochs 5

# Train All 6 Models Sequentially
& "C:\Users\punag\anaconda3\envs\geovista\python.exe" -m app.training.train --task all --epochs 3
```

---

## 14. Evaluating Each Model

Validation metrics are saved to `artifacts/model_registry.json` and individual metric JSON files:
```powershell
# Inspect registered models and validation metrics
& "C:\Users\punag\anaconda3\envs\geovista\python.exe" -c "from app.services.model_registry import model_registry; import json; print(json.dumps(model_registry.list_models(), indent=2))"
```

---

## 15. Building and Evaluating Task-Specific Ensembles

Run intra-task ensembling (Weighted Averaging vs Best Single Model) and Cross-Task Environmental Intelligence:
```powershell
cd "c:\Users\punag\Downloads\NASA SPACE APPS unzipped\NASA SPACE APPS\backend"
& "C:\Users\punag\anaconda3\envs\geovista\python.exe" -m app.ensemble.run_ensemble
```

---

## 16. Running Predictions on New AOIs and Dates

Execute live GPU forward inference for any AOI:
```powershell
# Query prediction via API or Python
& "C:\Users\punag\anaconda3\envs\geovista\python.exe" -c "
from app.inference.vegetation_inference import vegetation_inference_engine
res = vegetation_inference_engine.run_forecast(aoi_coords=[88.5, 21.5, 89.2, 22.3], start_date='2024-01-01')
print('Summary:', res['summary'])
print('First 3 forecast points:', res['forecast'][:3])
"
```

---

## 17. Starting the FastAPI Backend

Launch the production FastAPI server:
```powershell
cd "c:\Users\punag\Downloads\NASA SPACE APPS unzipped\NASA SPACE APPS\backend"
& "C:\Users\punag\anaconda3\envs\geovista\python.exe" app/main.py
```
- Interactive Swagger UI: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`
- Frontend compatibility health: `http://localhost:8000/api/system/health`

---

## 18. Connecting the Existing GEOVISTA Frontend

The React + TypeScript + Vite + OpenLayers frontend is pre-configured to communicate with the FastAPI backend:
```powershell
# In a new PowerShell window:
cd "c:\Users\punag\Downloads\NASA SPACE APPS unzipped\NASA SPACE APPS\FRONT END"

# Start the Vite development server
npm run dev
```
Open `http://localhost:5173` in your browser.
- To switch the frontend from synthetic demo fixtures to the **Live Python GPU Backend**, edit `FRONT END/.env`:
```text
VITE_API_BASE_URL=http://localhost:8000
VITE_ENABLE_MOCK_DATA=false
```

---

## 19. Troubleshooting Common Errors

| Error | Root Cause | Solution |
|---|---|---|
| `No module named 'app'` | Command executed from outside the `backend/` directory | Always `cd backend` before running `python -m app...` |
| `Torch not compiled with CUDA enabled` | CPU-only PyTorch build installed in environment | Run `pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121` |
| `NameError: name 'Path' is not defined` | Missing import in router worker | Resolved in `app/api/v1/router.py` |
| `TypeError: UNet.__init__() got unexpected keyword argument 'base_filters'` | Architecture uses `base_features` | Resolved in `app/training/train.py` |
| `AttributeError: 'LandCoverTrainer' has no attribute 'evaluate'` | Method was named `evaluate_test_set` | Alias `evaluate = evaluate_test_set` added to `landcover_trainer.py` |

---

## 20. Managing Checkpoints, Temporary Files, and Results

All artifacts are persisted in `backend/artifacts/`:
- `artifacts/flagship_vegetation_lstm_best.pt`: PyTorch weights of the best vegetation model.
- `artifacts/flagship_vegetation_metrics.json`: Full evaluation results and R² scores.
- `artifacts/vegetation_phenology_dataset.npz`: Multi-biome training and validation splits.
- `artifacts/model_registry.json`: Registry records of all trained models and metric rankings.

To clear temporary caches:
```powershell
cd "c:\Users\punag\Downloads\NASA SPACE APPS unzipped\NASA SPACE APPS\backend"
Get-ChildItem -Path . -Include "__pycache__" -Recurse | Remove-Item -Force -Recurse
```

# GEOVISTA Intelligence — Backend Platform

GEOVISTA Intelligence is a multi-source geospatial AI system designed for Earth Observation (EO) modeling, environmental hazard forecasting, and scientific decision intelligence.

The backend ingests data from 11 satellite/reference providers, trains 6 specialist deep-learning model families, maintains anti-leakage splitting, and exposes predictions through an asynchronous FastAPI service layer.

---

## Architecture Overview

```
backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       └── router.py             # FastAPI REST endpoints
│   ├── core/
│   │   ├── config.py                 # Configuration settings
│   │   ├── exceptions.py             # Custom domain exceptions
│   │   ├── hardware.py               # CPU/CUDA detection & auto-tuning
│   │   └── settings.py               # Pydantic Settings
│   ├── data/
│   │   ├── downloads/                # Download & rate-limiting manager
│   │   ├── harmonization/            # Grid alignment & spatial harmonization
│   │   ├── labels/                   # Anti-leakage splitters & PyTorch Dataset loaders
│   │   ├── metadata/                 # Provenance & dataset manifests
│   │   ├── preprocessing/            # Calibration, QA masking, reprojection
│   │   ├── providers/                # 11 satellite data discovery adapters
│   │   ├── storage/                  # Windowed raster access & cache
│   │   └── validation/               # Schema & geometry validation
│   ├── ensemble/
│   │   ├── ensemble.py               # Weighted avg, stacking, cross-task synthesis
│   │   └── ensemble_evaluation.py    # Multi-model benchmarking
│   ├── evaluation/
│   │   └── metrics.py                # IoU, mIoU, Dice, RMSE, MAE, R², F1
│   ├── models/
│   │   ├── base_model.py             # Abstract base model & checkpointing
│   │   ├── change_detection/         # Siamese U-Net & differencing
│   │   ├── coastal/                  # Coastal dynamics & shoreline tracker
│   │   ├── deformation/              # InSAR deformation neural net & phase unwrapping
│   │   ├── flood/                    # SAR Otsu thresholding & Flood U-Net
│   │   ├── landcover/                # Land cover U-Net & class mapping
│   │   └── vegetation/               # Temporal LSTM & Random Forest
│   ├── services/
│   │   ├── job_manager.py            # Non-blocking async background job runner
│   │   └── model_registry.py         # Model checkpoint & metrics registry
│   ├── training/                     # Standalone training pipelines for all 6 tasks
│   └── utils/                        # Geospatial math, CRS reprojection & arrays
├── artifacts/                        # Model weights (.pt) & registry records
├── configs/                          # YAML experiment & pipeline configs
├── tests/                            # TestClient & unit verification suites
└── app/main.py                       # FastAPI application entry point
```

---

## 1. Supported Satellite Data Sources (11 Providers)

1. **MODIS MOD13Q1 v061** (250m 16-day NDVI/EVI composites)
2. **Sentinel-2 Level-2A** (10m/20m/60m Bottom-of-Atmosphere MSI)
3. **Landsat 8/9 Collection 2 L2** (30m OLI-2 / TIRS-2 surface reflectance)
4. **NASA HLS v2.0** (Harmonized Landsat Sentinel 30m grid)
5. **Sentinel-1 C-SAR** (10m GRD dual-pol & SLC interferometry)
6. **NASA-ISRO NISAR** (L-band / S-band simulated & GCOV radar)
7. **NASA JPL UAVSAR** (1.6m airborne polarimetric L-band SAR)
8. **RADARSAT Constellation Mission (RCM)** (Compact polarimetry C-SAR)
9. **RADARSAT-1** (Historical C-band SAR archive 1995-2013)
10. **CONAE SAOCOM 1A/1B** (Full polarimetric L-band SAR)
11. **ESA WorldCover 10m** (Authoritative 11-class global ground truth)

---

## 2. Supported Specialist Models (6 Domains)

| Task | Primary Data | Architectures | Target Outputs |
|------|--------------|---------------|----------------|
| **Vegetation** | MODIS, S2, Landsat | Temporal LSTM, Random Forest | NDVI/EVI forecasting, anomaly detection |
| **Land Cover** | Sentinel-2, Landsat, WorldCover | U-Net 4-Stage, Random Forest | 11-class semantic segmentation (mIoU) |
| **Change Detection** | Bi-temporal S2 / Landsat | Siamese Twin U-Net | Urban expansion, deforestation, water change |
| **Flood Inundation** | Sentinel-1, RCM, SAOCOM SAR | Dual-pol Flood U-Net, Otsu Threshold | Calibrated flood extent & water probability |
| **Coastal Dynamics** | Optical MNDWI, SAR edges | Shoreline Transect Tracker | Accretion/erosion rates, coastline drift |
| **Ground Deformation**| S1, NISAR, UAVSAR InSAR SLC | DeformationNet, Coherence Filter | Millimetric displacement velocity (mm/year) |

---

## 3. Dedicated Python Environment (`geovista`)

This project executes in a dedicated Conda environment named **`geovista`**:
- Python Executable: `C:\Users\punag\anaconda3\envs\geovista\python.exe`
- Python Version: `3.11.18`

To run commands in this environment:
```powershell
conda activate geovista
```

---

## 4. API Endpoints Reference

The FastAPI service exposes the following endpoints (all non-blocking for long computations):

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Server status, CPU/CUDA hardware specs, RAM |
| `GET` | `/api/v1/datasets` | List 11 supported satellite collections |
| `POST` | `/api/v1/data/discover` | Query intersecting scenes by AOI bbox and date range |
| `POST` | `/api/v1/data/prepare` | Queue async data calibration, masking, and patch slicing |
| `POST` | `/api/v1/train/{task}` | Queue async model training job (returns `job_id`) |
| `GET` | `/api/v1/train/{job_id}` | Poll progress (0-100%), stage message, and final status |
| `GET` | `/api/v1/models` | List all registered trained models |
| `GET` | `/api/v1/models/{model_id}/metrics` | Retrieve validation metrics and confusion matrix |
| `POST` | `/api/v1/predict/{task}` | Run inference using best registered model for task |
| `POST` | `/api/v1/ensemble/predict` | Cross-task intelligence synthesis across all domains |

---

## 5. Running the Backend & Verification

### Start Server
```powershell
conda activate geovista
cd backend
python app/main.py
```
Open interactive docs at: `http://localhost:8000/docs`

### Run FastAPI Test Suite
```powershell
conda activate geovista
python backend/tests/test_api_client.py
```

### Connect Frontend
```powershell
cd "FRONT END"
npm install
npm run dev
```
Open `http://localhost:5173` to interact with maps, layer toggles, and model inference.

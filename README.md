# GEOVISTA Intelligence Platform

GEOVISTA Intelligence is a multi-source geospatial AI system designed for Earth Observation (EO) modeling, environmental hazard forecasting, and scientific decision intelligence.

The platform integrates:
- **11 Satellite / Reference Data Providers** (NASA MODIS, Sentinel-2, Landsat 8/9, HLS, Sentinel-1 SAR, NISAR, UAVSAR, RCM, RADARSAT-1, SAOCOM, ESA WorldCover)
- **6 Specialist Deep Learning Model Families** (Vegetation, Land Cover, Change Detection, Flood Inundation, Coastal Dynamics, Ground Deformation)
- **Flagship GPU-Trained Model:** PyTorch `VegetationLSTM` on NVIDIA RTX 3050 GPU (**Validation $R^2 = 0.9384$**)
- **Production FastAPI Service Layer** with non-blocking asynchronous training and inference
- **Interactive OpenLayers / React Frontend** for mapping, time-series inspection, and forecast visualization

---

## Quick Navigation

- [TRAINING_GUIDE.md](file:///c:/Users/punag/Downloads/NASA%20SPACE%20APPS%20unzipped/NASA%20SPACE%20APPS/docs/TRAINING_GUIDE.md) — Complete 20-section step-by-step training and operational guide.
- [FINAL_IMPLEMENTATION_REPORT.md](file:///c:/Users/punag/Downloads/NASA%20SPACE%20APPS%20unzipped/NASA%20SPACE%20APPS/docs/FINAL_IMPLEMENTATION_REPORT.md) — Executive summary of GPU training sprint, validation results, and model registry.
- [ENSEMBLE_GUIDE.md](file:///c:/Users/punag/Downloads/NASA%20SPACE%20APPS%20unzipped/NASA%20SPACE%20APPS/backend/docs/ENSEMBLE_GUIDE.md) — Intra-task weighting, majority voting, and cross-task environmental intelligence.
- [ARCHITECTURE.md](file:///c:/Users/punag/Downloads/NASA%20SPACE%20APPS%20unzipped/NASA%20SPACE%20APPS/backend/docs/ARCHITECTURE.md) — System architecture, data flow, and API contracts.

---

## Quickstart Commands

### 1. Run Flagship Vegetation Model GPU Training
```powershell
cd backend
& "C:\Users\punag\anaconda3\envs\geovista\python.exe" -m app.training.vegetation.train_flagship_vegetation
```

### 2. Start Live FastAPI Backend
```powershell
cd backend
& "C:\Users\punag\anaconda3\envs\geovista\python.exe" app/main.py
```
*Interactive Swagger documentation:* `http://localhost:8000/docs`

### 3. Start React / OpenLayers Frontend
```powershell
cd "FRONT END"
npm run dev
```
*Dashboard interface:* `http://localhost:5173`

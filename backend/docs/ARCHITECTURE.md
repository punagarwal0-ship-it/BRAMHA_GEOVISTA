# GEOVISTA Intelligence — System Architecture (Phase 1 Baseline)

## 1. Executive Overview

**GEOVISTA Intelligence** is an environmental monitoring and geospatial AI platform designed to ingest, harmonize, analyze, and forecast multi-sensor Earth observation data. The platform couples:
1. **Interactive Geospatial Web Client**: A React 18, TypeScript, Vite, Tailwind CSS, and OpenLayers application providing time-series exploration, side-by-side comparison swipe viewers, interactive Area of Interest (AOI) drawing, and analytics visualization.
2. **Modular Python Geospatial Machine Learning Backend**: A Python backend implementing provider-agnostic data discovery, memory-first windowed preprocessing, modular deep learning and statistical specialist models, task-aware ensemble reasoning, and asynchronous execution.

---

## 2. System Architecture & Component Interactions

```
+---------------------------------------------------------------------------------------+
|                                    GEOVISTA FRONTEND                                  |
|                             React 18 + OpenLayers + Vite                              |
|                                                                                       |
|  [Map Canvas / OL] <---> [Time Slider / Scrubber] <---> [Swipe Comparison Viewer]    |
|          ^                                                        ^                   |
|          |                                                        |                   |
|  [AOI Drawing Tools]                                     [Layer Control Stack]        |
|          \                                                        /                   |
|           +-----------------> [apiAdapter.ts] <------------------+                    |
+--------------------------------------|------------------------------------------------+
                                       | HTTP REST / Async JSON
                                       v
+---------------------------------------------------------------------------------------+
|                                 GEOVISTA PYTHON BACKEND                               |
|                                (FastAPI Application)                                  |
|                                                                                       |
|   /api/v1/health       /api/v1/datasets/discover        /api/v1/models                |
|   /api/v1/train/{task} /api/v1/train/{job_id}           /api/v1/predict/{task}        |
|   /api/v1/ensemble/predict                                                            |
+--------------------------------------|------------------------------------------------+
                                       |
    +----------------------------------+----------------------------------+
    |                                  |                                  |
    v                                  v                                  v
+-----------------------+  +-----------------------+  +-------------------------------+
|    DATA INGESTION     |  |    PREPROCESSING &    |  |     SPECIALIST ML MODELS      |
|    PROVIDERS (app/data|  |     HARMONIZATION     |  |         (app/models/)         |
|                       |  |                       |  |                               |
| * NASA Earthdata/CMR  |  | * Reprojection/Warp   |  | 1. Vegetation (LSTM/TCN/RF)   |
| * MODIS (HDF-EOS)     |  | * Cloud/QA Masking    |  | 2. Land Cover (U-Net/RF)      |
| * Sentinel-2 (STAC)   |  | * Resampling (Bilinear|  | 3. Change Detection (Siamese) |
| * Landsat 8/9 (STAC)  |  |   vs Nearest Categor) |  | 4. Flood Detection (SAR U-Net)|
| * Sentinel-1 SAR (ASF)|  | * SAR Calibration/    |  | 5. Coastal Monitoring         |
| * NISAR / UAVSAR (ASF)|  |   Speckle Filtering   |  | 6. Surface Deformation        |
| * RCM / RADARSAT-1    |  | * Temporal Stacking   |  +---------------|---------------+
| * SAOCOM (CONAE)      |  | * Non-leaking Splits  |                  |
+-----------------------+  +-----------------------+                  v
                                                      +-------------------------------+
                                                      |   TASK-AWARE ENSEMBLE LAYER   |
                                                      |        (app/ensemble/)        |
                                                      |                               |
                                                      | * Within-task weighting / OOF |
                                                      | * Multi-sensor late fusion    |
                                                      | * Cross-task intelligence     |
                                                      +-------------------------------+
```

---

## 3. Existing Frontend Architecture & Integration State

The frontend is located in `FRONT END/` and is fully preserved:
- **Framework**: React 18 with TypeScript 5.7, bundled via Vite 6.1.
- **Mapping Engine**: OpenLayers 10.4 with WebGL-accelerated rendering and custom projection handling.
- **State & Service Layer**:
  - `src/services/apiAdapter.ts`: Dual-mode client interface. When `VITE_API_BASE_URL` is set and `VITE_ENABLE_MOCK_DATA="false"`, requests route to the live FastAPI backend. Otherwise, it transparently falls back to curated synthetic demonstration fixtures.
  - `src/types/api.ts`: Comprehensive TypeScript interfaces defining GeoJSON models, satellite collection metadata, observation scenes, time-series data points, change events, and probabilistic forecast intervals.
  - `src/components/`: Modular UI panels for AOI management, Scene catalog filtering, Map rendering, Split-screen comparison, Time slider controls, and Analytics display.
- **Build Verification**: Verified passing clean compilation (`npm run build` completed with zero TypeScript errors).

---

## 4. Backend Architecture & Module Boundaries

The backend is organized cleanly under `backend/` to ensure modularity, separation of concerns, and ease of testing:

### 4.1 Core (`app/core/`)
- `settings.py`: Pydantic-based configuration management loading environment variables from `.env`. Automatically validates and provisions local scratch and artifact directories.
- `hardware.py`: System resource profiling. Inspects CPU cores, total RAM, CUDA availability, device name, and GPU VRAM to compute safe, conservative batch sizes and worker thread counts.
- `logging_config.py`: Structured rich logging handler preventing log pollution from third-party libraries (Rasterio, Fiona, Shapely).
- `exceptions.py`: Domain-specific exception hierarchy (`DataProviderError`, `AuthenticationError`, `PreprocessingError`, `QualityFilterError`, `ModelError`, etc.).

### 4.2 Configuration (`app/config/` & `configs/`)
- `config_loader.py`: YAML parser loading and strictly validating project configuration schemas, spatial bounding boxes, and ISO date ranges.
- `configs/data_sources/`: Provider and product parameter files (e.g., `earthdata.yaml`, `sar_sources.yaml`).
- `configs/training/`: Training hyperparameter templates.

### 4.3 Data Pipeline (`app/data/`)
- `providers/`: Adapter classes implementing `BaseDataProvider`. Each adapter encapsulates provider-specific authentication, spatial/temporal metadata queries, and granule retrieval.
- `preprocessing/`:
  - `raster_preprocessor.py`: Reprojection, AOI windowed clipping, scale factor application, and spectral index calculations (NDVI, EVI, MNDWI, NBR, BSI).
  - `cloud_masking.py`: Strict bitmask decoders for MODIS Pixel Reliability, Landsat QA_PIXEL, Sentinel-2 SCL, and HLS Fmask.
  - `sar_preprocessor.py`: Linear to dB radiometric conversion, Lee speckle filtering, and polarization ratio derivations.
- `harmonization/`:
  - `harmonizer.py`: Common reference grid alignment, spatial resampling (nearest-neighbor strictly enforced for categorical data, bilinear for continuous spectra), and temporal stacking.
- `storage/`:
  - `dataset_store.py`: Memory-first lifecycle manager ensuring raw granules are cached in temporary scratch space and purged post-processing, retaining only model weights and evaluation artifacts.

### 4.4 Machine Learning & Inference (`app/models/`, `app/training/`, `app/ensemble/`)
- **Specialist Models**:
  - `vegetation`: Random Forest, XGBoost, and deep sequential models (LSTM, TCN) operating on calibrated time-series.
  - `landcover`: Semantic segmentation U-Net and pixel-level classifiers mapped to standardized land cover schemas.
  - `change_detection`: Coregistered image-pair difference baselines and Siamese networks.
  - `flood`: Dual-polarization SAR backscatter thresholding and U-Net water segmentation.
  - `coastal`: Water index edge-detection and coastal water body tracking.
  - `deformation`: InSAR pipeline guidance and coherence-change proxy indicators.
- **Ensemble Layer**: Within-task validation-weighted averaging, stacking with out-of-fold predictions, and cross-task environmental summary aggregation.

---

## 5. Security, Memory & Reproducibility Principles

1. **Authentication Safety**: Credentials (NASA Earthdata URS, ASF, EODMS, CONAE) are read exclusively from environment variables or secure local stores; never committed to source control.
2. **Memory-First Processing**: Big Earth data files are read using windowed raster I/O. Raw staging caches are isolated in temporary scratch directories and discarded after training patch extraction.
3. **Data Leakage Prevention**:
   - Time-series forecasting models strictly employ chronological train/validation/test splits.
   - Spatial models employ spatially buffered splits to prevent spatial autocorrelation leakage between training and evaluation patches.

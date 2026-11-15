// Typed API contracts and Geospatial data models
// Aligned with Frontend Brief (Section 8) & ML Brief (Section 10-11)

export type CRS = 'EPSG:4326' | 'EPSG:3857';

export interface GeoJSONPoint {
  type: 'Point';
  coordinates: [number, number]; // [lon, lat]
}

export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: number[][][]; // [ [ [lon, lat], ... ] ]
}

export interface GeoJSONMultiPolygon {
  type: 'MultiPolygon';
  coordinates: number[][][][];
}

export type AOIGeometry = GeoJSONPoint | GeoJSONPolygon | GeoJSONMultiPolygon;

export interface AOI {
  id: string;
  name: string;
  geometry: AOIGeometry;
  areaSqKm: number;
  crs: CRS;
  bbox: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  center: [number, number]; // [lon, lat]
  createdAt: string;
  bufferKm?: number;
}

export type PhenomenonType =
  | 'vegetation'
  | 'water'
  | 'urbanisation'
  | 'flooding'
  | 'glacier'
  | 'coastal'
  | 'deformation';

export interface PhenomenonConfig {
  id: PhenomenonType;
  title: string;
  description: string;
  primarySensor: string;
  defaultIndicator: string;
  supportedIndicators: IndicatorDefinition[];
  colorRamp: {
    name: string;
    stops: { value: number; color: string; label: string }[];
  };
}

export interface IndicatorDefinition {
  id: string;
  name: string;
  unit: string;
  description: string;
  formula?: string;
  range: [number, number];
}

export interface SatelliteCollection {
  id: string;
  name: string;
  provider: 'ESA / Copernicus' | 'NASA / USGS' | 'ISRO / NRSC' | 'Planet / Harmonized';
  sensor: string;
  resolutionMeters: number;
  revisitDays: number;
  spectralBands: string[];
}

export type QualityFlag =
  | 'valid'
  | 'cloud_masked'
  | 'shadow_masked'
  | 'snow_shadow'
  | 'interpolated_warning'
  | 'insufficient_signal';

export interface ObservationScene {
  id: string;
  provider: string;
  collection: string;
  productId: string;
  acquiredAt: string; // ISO 8601
  footprint: GeoJSONPolygon;
  cloudCoverPct: number;
  qualityFlag: QualityFlag;
  resolutionMeters: number;
  sunAzimuth: number;
  sunElevation: number;
  thumbnailUrl: string;
  assetUri?: string;
  isDemoSynthetic?: boolean;
}

export interface CatalogSearchParams {
  aoi: AOIGeometry;
  startDate: string;
  endDate: string;
  collections: string[];
  maxCloudCover: number;
}

export interface TimeSeriesPoint {
  timestamp: string; // ISO 8601
  value: number;
  unit: string;
  qualityFlag: QualityFlag;
  validObservationCount: number;
  sourceReference: string;
  anomaly?: boolean;
  anomalyDescription?: string;
}

export interface ChangeEvent {
  id: string;
  date: string;
  changeType: 'abrupt_drop' | 'rapid_growth' | 'water_inundation' | 'urban_conversion' | 'glacier_retreat';
  magnitude: number;
  unit: string;
  description: string;
  confidencePct: number;
  affectedAreaSqKm?: number;
}

export type ForecastStatus = 'forecast' | 'insufficient_history' | 'climatology_fallback';

export interface ForecastPoint {
  timestamp: string; // ISO 8601
  predictedValue: number;
  lowerBound: number; // 80% CI
  upperBound: number; // 80% CI
  lowerBound95: number; // 95% CI
  upperBound95: number; // 95% CI
  unit: string;
  forecastStatus: ForecastStatus;
}

export interface ForecastModelMetadata {
  modelId: string;
  modelName: string;
  modelVersion: string;
  algorithmFamily: 'Seasonal-ARIMA' | 'Spatiotemporal-XGBoost' | 'Siamese U-Net' | 'LSTM-Temporal' | 'RandomForest';
  generationDate: string;
  trainingWindow: {
    start: string;
    end: string;
  };
  evaluationMetrics: {
    rmse: number;
    mae: number;
    r2: number;
  };
  uncertaintyMethod: string;
  limitations: string[];
  inputDataCoveragePct: number;
  isSpatiotemporalLayerAvailable: boolean;
  warningNotice?: string;
}

export interface LayerDefinition {
  id: string;
  name: string;
  type: 'basemap' | 'raster_overlay' | 'vector_footprints' | 'prediction_raster';
  url: string;
  visible: boolean;
  opacity: number;
  attribution: string;
  description?: string;
  legend?: {
    title: string;
    units: string;
    items: { color: string; label: string }[];
  };
}

export type JobStatusType = 'queued' | 'running' | 'completed' | 'failed' | 'partial_data';

export interface AnalysisJob {
  id: string;
  aoiId: string;
  aoiName: string;
  phenomenon: PhenomenonType;
  indicator: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  aggregation: 'daily' | '5day' | 'monthly' | 'seasonal' | 'annual';
  status: JobStatusType;
  progressPct: number;
  currentStage: string;
  submittedAt: string;
  completedAt?: string;
  error?: string;
  isDemoSynthetic?: boolean;
}

export interface AnalysisJobResults {
  jobId: string;
  aoi: AOI;
  observations: TimeSeriesPoint[];
  changes: ChangeEvent[];
  forecast: ForecastPoint[];
  forecastMetadata: ForecastModelMetadata;
  layers: LayerDefinition[];
  isDemoSynthetic: boolean;
}

// Uploaded Dataset Contracts for Comparison UI (Brief Section 5)
export interface DatasetRecord {
  recordId: string;
  timestamp: string; // ISO 8601 or YYYY-MM-DD
  assetReference?: string; // Image URL, tile URL, or preview
  layerType?: 'raster' | 'vector' | 'tabular';
  geometryOrExtent?: GeoJSONPolygon | [number, number, number, number];
  variable?: string;
  band?: string;
  value?: number;
  unit?: string;
  qualityFlag?: QualityFlag | string;
  sourceReference?: string;
  metadata?: Record<string, any>;
}

export interface DatasetFieldMapping {
  idField: string;
  timeField: string;
  valueField: string;
  assetField: string;
  variableField: string;
  geometryField?: string;
}

export interface ValidationReport {
  status: 'valid' | 'warning' | 'invalid';
  totalRows: number;
  validRecords: number;
  invalidRecords: number;
  messages: string[];
  missingColumns?: string[];
}

export interface UploadedDataset {
  id: string;
  name: string;
  format: 'geojson' | 'csv' | 'json' | 'stac' | 'imagery';
  sizeBytes: number;
  rawText?: string;
  records: DatasetRecord[];
  dateRange: {
    start: string;
    end: string;
  };
  availableVariables: string[];
  spatialCoverage?: {
    bbox: [number, number, number, number];
    centroid: [number, number];
  };
  detectedFields: DatasetFieldMapping;
  validation: ValidationReport;
  uploadedAt: string;
  isDemoSample?: boolean;
}



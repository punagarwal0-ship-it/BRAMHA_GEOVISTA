import {
  AOI,
  PhenomenonConfig,
  ObservationScene,
  TimeSeriesPoint,
  ChangeEvent,
  ForecastPoint,
  ForecastModelMetadata,
  LayerDefinition,
  SatelliteCollection
} from '../types/api';
import { calculateBoundingBox, calculateCentroid, calculatePolygonAreaSqKm } from './geoUtils';

// Supported Satellite Collections
export const SUPPORTED_COLLECTIONS: SatelliteCollection[] = [
  {
    id: 'sentinel-2-l2a',
    name: 'Sentinel-2 MSI Level-2A',
    provider: 'ESA / Copernicus',
    sensor: 'MSI (MultiSpectral Instrument)',
    resolutionMeters: 10,
    revisitDays: 5,
    spectralBands: ['B02 (Blue)', 'B03 (Green)', 'B04 (Red)', 'B08 (NIR)', 'B11 (SWIR1)', 'B12 (SWIR2)']
  },
  {
    id: 'landsat-9-c2l2',
    name: 'Landsat 9 OLI-2/TIRS-2 Collection 2 L2',
    provider: 'NASA / USGS',
    sensor: 'OLI-2 (Operational Land Imager)',
    resolutionMeters: 30,
    revisitDays: 16,
    spectralBands: ['B2 (Blue)', 'B3 (Green)', 'B4 (Red)', 'B5 (NIR)', 'B6 (SWIR1)', 'B10 (Thermal)']
  },
  {
    id: 'sentinel-1-grd',
    name: 'Sentinel-1 C-SAR GRD',
    provider: 'ESA / Copernicus',
    sensor: 'C-Band Synthetic Aperture Radar',
    resolutionMeters: 10,
    revisitDays: 6,
    spectralBands: ['VV (Vertical Co-pol)', 'VH (Cross-pol)']
  },
  {
    id: 'isro-resourcesat-awifs',
    name: 'ISRO Resourcesat-2A AWiFS (Bhoonidhi)',
    provider: 'ISRO / NRSC',
    sensor: 'Advanced Wide Field Sensor',
    resolutionMeters: 56,
    revisitDays: 5,
    spectralBands: ['B2 (Green)', 'B3 (Red)', 'B4 (NIR)', 'B5 (SWIR)']
  }
];

// Supported Phenomena Configurations
export const PHENOMENA_CONFIGS: Record<string, PhenomenonConfig> = {
  vegetation: {
    id: 'vegetation',
    title: 'Vegetation & Forest Phenology',
    description: 'Monitor canopy vigor, deforestation, mangrove dynamics, and agricultural cycles.',
    primarySensor: 'Sentinel-2 MSI (10m) / Landsat-9 (30m)',
    defaultIndicator: 'ndvi',
    supportedIndicators: [
      {
        id: 'ndvi',
        name: 'Normalized Difference Vegetation Index (NDVI)',
        unit: 'Index (-1 to 1)',
        description: 'Measures healthy green vegetation density based on red and NIR reflectance.',
        formula: '(NIR - Red) / (NIR + Red)',
        range: [-0.2, 1.0]
      },
      {
        id: 'evi',
        name: 'Enhanced Vegetation Index (EVI)',
        unit: 'Index (-1 to 1)',
        description: 'Optimized index with reduced atmospheric and canopy background noise.',
        formula: '2.5 * ((NIR - Red) / (NIR + 6*Red - 7.5*Blue + 1))',
        range: [-0.2, 1.0]
      },
      {
        id: 'canopy_cover',
        name: 'Estimated Canopy Fraction',
        unit: '% Area',
        description: 'Fraction of ground covered by tree or mangrove crowns.',
        range: [0, 100]
      }
    ],
    colorRamp: {
      name: 'YlGn (Yellow-Green Vegetation)',
      stops: [
        { value: 0.0, color: '#f7fcb9', label: 'Barren / Sparse (< 0.2)' },
        { value: 0.4, color: '#addd8e', label: 'Moderate Canopy (0.4)' },
        { value: 0.7, color: '#31a354', label: 'Dense Healthy Forest (0.7)' },
        { value: 0.9, color: '#006837', label: 'Very Dense Mangrove / Jungle (> 0.85)' }
      ]
    }
  },
  water: {
    id: 'water',
    title: 'Water Bodies & Hydrology',
    description: 'Track lake surface water extent, wetland seasonal pulses, reservoir storage, and river course.',
    primarySensor: 'Sentinel-2 MSI & Sentinel-1 SAR',
    defaultIndicator: 'ndwi',
    supportedIndicators: [
      {
        id: 'ndwi',
        name: 'Normalized Difference Water Index (NDWI)',
        unit: 'Index (-1 to 1)',
        description: 'Maximizes reflectance of water bodies using green and NIR wavelengths.',
        formula: '(Green - NIR) / (Green + NIR)',
        range: [-1.0, 1.0]
      },
      {
        id: 'mndwi',
        name: 'Modified NDWI (Xu 2006)',
        unit: 'Index (-1 to 1)',
        description: 'Replaces NIR with SWIR to sharply diminish urban/soil false positives.',
        formula: '(Green - SWIR) / (Green + SWIR)',
        range: [-1.0, 1.0]
      },
      {
        id: 'water_area',
        name: 'Inundated Water Surface Extent',
        unit: 'km²',
        description: 'Total classified open water area in square kilometers.',
        range: [0, 2000]
      }
    ],
    colorRamp: {
      name: 'Blues (Water Inundation)',
      stops: [
        { value: -0.2, color: '#f7fbff', label: 'Dry Land' },
        { value: 0.0, color: '#9ecae1', label: 'Moist / Boundary' },
        { value: 0.3, color: '#3182bd', label: 'Shallow Water' },
        { value: 0.7, color: '#08519c', label: 'Deep Open Water' }
      ]
    }
  },
  urbanisation: {
    id: 'urbanisation',
    title: 'Urban Expansion & Land Transition',
    description: 'Track impervious surface growth, built-up sprawl, and loss of peri-urban agricultural fringes.',
    primarySensor: 'Sentinel-2 MSI / Landsat 9',
    defaultIndicator: 'ndbi',
    supportedIndicators: [
      {
        id: 'ndbi',
        name: 'Normalized Difference Built-Up Index (NDBI)',
        unit: 'Index (-1 to 1)',
        description: 'Highlights built-up structures and paved infrastructure via SWIR and NIR.',
        formula: '(SWIR - NIR) / (SWIR + NIR)',
        range: [-1.0, 1.0]
      },
      {
        id: 'impervious_pct',
        name: 'Impervious Surface Fraction',
        unit: '% Area',
        description: 'Estimated concrete, asphalt, and roof coverage.',
        range: [0, 100]
      }
    ],
    colorRamp: {
      name: 'Oranges / Purples (Built Up)',
      stops: [
        { value: -0.3, color: '#fef0d9', label: 'Vegetated Non-urban' },
        { value: 0.0, color: '#fdbb84', label: 'Sparse / Developing' },
        { value: 0.25, color: '#e34a33', label: 'Dense Urban' },
        { value: 0.5, color: '#b30000', label: 'Heavy Commercial / Industrial' }
      ]
    }
  },
  flooding: {
    id: 'flooding',
    title: 'Flood Extent & SAR Inundation',
    description: 'All-weather radar flood mapping using Sentinel-1 C-band SAR backscatter thresholds.',
    primarySensor: 'Sentinel-1 C-SAR GRD (VV/VH)',
    defaultIndicator: 'flood_extent',
    supportedIndicators: [
      {
        id: 'flood_extent',
        name: 'Inundated Flood Extent',
        unit: 'km²',
        description: 'Estimated inundated land area outside normal permanent water bodies.',
        range: [0, 1000]
      },
      {
        id: 'sar_backscatter',
        name: 'SAR Backscatter Sigma-0 (VH)',
        unit: 'dB',
        description: 'Cross-polarization backscatter intensity; open calm water displays very low values (< -22 dB).',
        formula: '10 * log10(Sigma0_VH)',
        range: [-30, 0]
      }
    ],
    colorRamp: {
      name: 'Teal/Cyan (Flood Anomaly)',
      stops: [
        { value: 0, color: '#e0f3f8', label: 'Normal Dry Land' },
        { value: 50, color: '#67a9cf', label: 'Temporarily Inundated' },
        { value: 150, color: '#02818a', label: 'Deep / Severe Flood' }
      ]
    }
  },
  glacier: {
    id: 'glacier',
    title: 'Glacier & Cryosphere Monitoring',
    description: 'Measure snowline elevation, snout retreat, and snow cover extent in high-altitude terrain.',
    primarySensor: 'Landsat 8/9 & Sentinel-2',
    defaultIndicator: 'ndsi',
    supportedIndicators: [
      {
        id: 'ndsi',
        name: 'Normalized Difference Snow Index (NDSI)',
        unit: 'Index (-1 to 1)',
        description: 'Separates snow from clouds based on high green and low SWIR reflectance.',
        formula: '(Green - SWIR) / (Green + SWIR)',
        range: [-0.5, 1.0]
      },
      {
        id: 'snow_area',
        name: 'Snow & Ice Extent',
        unit: 'km²',
        description: 'Total classified glacial and permanent snow cover.',
        range: [0, 500]
      }
    ],
    colorRamp: {
      name: 'Cool Blues (Glacial Cryosphere)',
      stops: [
        { value: 0.1, color: '#f7fbff', label: 'Bare Rock / Moraine' },
        { value: 0.4, color: '#9ecae1', label: 'Firn / Dirty Ice' },
        { value: 0.7, color: '#4292c6', label: 'Clean Glacial Ice' },
        { value: 0.9, color: '#08306b', label: 'Fresh Alpine Snowpack' }
      ]
    }
  }
};

// Curated Demo AOIs for Instant Test-drive
export const CURATED_AOIS: AOI[] = [
  {
    id: 'sundarbans-mangroves',
    name: 'Sundarbans Biosphere Reserve',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [88.65, 21.65],
        [89.15, 21.65],
        [89.15, 22.05],
        [88.65, 22.05],
        [88.65, 21.65]
      ]]
    },
    areaSqKm: 2314.5,
    crs: 'EPSG:4326',
    bbox: [88.65, 21.65, 89.15, 22.05],
    center: [88.90, 21.85],
    createdAt: '2026-01-15T08:00:00Z'
  },
  {
    id: 'chilika-lagoon',
    name: 'Chilika Lake & Daya Delta',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [85.10, 19.45],
        [85.60, 19.45],
        [85.60, 19.90],
        [85.10, 19.90],
        [85.10, 19.45]
      ]]
    },
    areaSqKm: 1165.2,
    crs: 'EPSG:4326',
    bbox: [85.10, 19.45, 85.60, 19.90],
    center: [85.35, 19.68],
    createdAt: '2026-01-18T10:30:00Z'
  },
  {
    id: 'hyderabad-urban',
    name: 'Hyderabad Cyberabad Growth Corridor',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [78.28, 17.38],
        [78.48, 17.38],
        [78.48, 17.52],
        [78.28, 17.52],
        [78.28, 17.38]
      ]]
    },
    areaSqKm: 345.8,
    crs: 'EPSG:4326',
    bbox: [78.28, 17.38, 78.48, 17.52],
    center: [78.38, 17.45],
    createdAt: '2026-02-01T12:00:00Z'
  },
  {
    id: 'kuttanad-flood',
    name: 'Kuttanad & Vembanad Wetlands',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [76.35, 9.35],
        [76.58, 9.35],
        [76.58, 9.68],
        [76.35, 9.68],
        [76.35, 9.35]
      ]]
    },
    areaSqKm: 780.4,
    crs: 'EPSG:4326',
    bbox: [76.35, 9.35, 76.58, 9.68],
    center: [76.46, 9.51],
    createdAt: '2026-02-10T14:15:00Z'
  },
  {
    id: 'gangotri-glacier',
    name: 'Gangotri Glacier Terminus',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [79.05, 30.82],
        [79.28, 30.82],
        [79.28, 31.02],
        [79.05, 31.02],
        [79.05, 30.82]
      ]]
    },
    areaSqKm: 485.6,
    crs: 'EPSG:4326',
    bbox: [79.05, 30.82, 79.28, 31.02],
    center: [79.16, 30.92],
    createdAt: '2026-02-14T09:45:00Z'
  }
];

// Helper to generate realistic scene catalog fixtures
export function generateCatalogScenes(aoi: AOI): ObservationScene[] {
  const [minLon, minLat, maxLon, maxLat] = aoi.bbox;
  const scenes: ObservationScene[] = [];
  const providers = [
    { p: 'ESA / Copernicus', c: 'Sentinel-2 L2A', s: 'MSI', res: 10, prefix: 'S2A_MSIL2A' },
    { p: 'ESA / Copernicus', c: 'Sentinel-2 L2A', s: 'MSI', res: 10, prefix: 'S2B_MSIL2A' },
    { p: 'NASA / USGS', c: 'Landsat 9 C2L2', s: 'OLI-2', res: 30, prefix: 'LC09_L2SP' },
    { p: 'ESA / Copernicus', c: 'Sentinel-1 GRD', s: 'C-SAR', res: 10, prefix: 'S1A_IW_GRDH' }
  ];

  // Base dates representing recent multi-temporal acquisitions
  const timestamps = [
    '2024-03-05T05:12:31Z',
    '2024-02-24T05:15:22Z',
    '2024-02-14T05:12:44Z',
    '2024-01-30T05:14:18Z',
    '2024-01-15T05:13:02Z',
    '2023-12-26T05:15:33Z',
    '2023-11-20T05:12:15Z',
    '2023-10-15T05:14:50Z'
  ];

  timestamps.forEach((ts, idx) => {
    const prov = providers[idx % providers.length];
    const isCloudy = idx === 3; // Cloud overcast sample
    const cloudPct = isCloudy ? 68.4 : Number((Math.random() * 8.5).toFixed(1));
    const pad = 0.08;

    const footprint: ObservationScene['footprint'] = {
      type: 'Polygon',
      coordinates: [[
        [minLon - pad, minLat - pad],
        [maxLon + pad, minLat - pad],
        [maxLon + pad, maxLat + pad],
        [minLon - pad, maxLat + pad],
        [minLon - pad, minLat - pad]
      ]]
    };

    scenes.push({
      id: `scene-${idx + 1}`,
      provider: prov.p,
      collection: prov.c,
      productId: `${prov.prefix}_${ts.replace(/[-:]/g, '').slice(0, 15)}_T45QVG`,
      acquiredAt: ts,
      footprint,
      cloudCoverPct: cloudPct,
      qualityFlag: isCloudy ? 'cloud_masked' : 'valid',
      resolutionMeters: prov.res,
      sunAzimuth: Number((135 + Math.random() * 20).toFixed(1)),
      sunElevation: Number((42 + Math.random() * 15).toFixed(1)),
      thumbnailUrl: `https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?auto=format&fit=crop&w=400&q=80`,
      assetUri: `s3://bramha-data-lake/catalog/${prov.prefix}_sample.tif`,
      isDemoSynthetic: true
    });
  });

  return scenes;
}

// Generate Realistic Historical Time Series & Changes
export function generateHistoricalAnalysis(
  phenomenon: string,
  indicator: string
): {
  observations: TimeSeriesPoint[];
  changes: ChangeEvent[];
  forecast: ForecastPoint[];
  forecastMetadata: ForecastModelMetadata;
  layers: LayerDefinition[];
} {
  const observations: TimeSeriesPoint[] = [];
  const changes: ChangeEvent[] = [];
  const forecast: ForecastPoint[] = [];

  // Monthly timestamps from Jan 2022 to Feb 2024 (26 historical points)
  const months = [
    '2022-01-15', '2022-02-15', '2022-03-15', '2022-04-15', '2022-05-15', '2022-06-15',
    '2022-07-15', '2022-08-15', '2022-09-15', '2022-10-15', '2022-11-15', '2022-12-15',
    '2023-01-15', '2023-02-15', '2023-03-15', '2023-04-15', '2023-05-15', '2023-06-15',
    '2023-07-15', '2023-08-15', '2023-09-15', '2023-10-15', '2023-11-15', '2023-12-15',
    '2024-01-15', '2024-02-15'
  ];

  // Specific baseline parameters by phenomenon
  let baseValue = 0.65;
  let seasonalAmp = 0.18;
  let trend = -0.002;
  let unit = 'Index (-1 to 1)';

  if (phenomenon === 'water') {
    baseValue = 0.42;
    seasonalAmp = 0.28;
    unit = indicator === 'water_area' ? 'km²' : 'Index (-1 to 1)';
  } else if (phenomenon === 'urbanisation') {
    baseValue = 0.18;
    seasonalAmp = 0.03;
    trend = 0.006; // Steady urban growth
    unit = indicator === 'impervious_pct' ? '%' : 'Index (-1 to 1)';
  } else if (phenomenon === 'flooding') {
    baseValue = 45.0;
    seasonalAmp = 85.0;
    unit = 'km² Inundation';
  } else if (phenomenon === 'glacier') {
    baseValue = 0.58;
    seasonalAmp = 0.22;
    trend = -0.005; // Glacial retreat trend
    unit = 'Index (-1 to 1)';
  }

  // Populate Historical Points with Genuine Discrete Seasonality & Data Gaps
  months.forEach((dateStr, idx) => {
    const monthNum = parseInt(dateStr.slice(5, 7), 10);
    // Monsoon peak / summer dry seasonal curve
    const seasonalFactor = Math.sin(((monthNum - 3) / 12) * 2 * Math.PI);
    
    // Monsoon cloud gap test: In July/August, cloudy acquisitions
    const isCloudGap = (monthNum === 7 || monthNum === 8) && (idx % 2 === 0);
    
    let rawVal = baseValue + seasonalAmp * seasonalFactor + trend * idx;
    // Add small random noise
    rawVal += (Math.random() - 0.5) * 0.04;
    rawVal = Number(rawVal.toFixed(3));

    // Anomaly event injection
    let isAnomaly = false;
    let anomalyDesc = '';
    if (dateStr === '2023-08-15' && phenomenon === 'flooding') {
      isAnomaly = true;
      rawVal = 320.5; // Massive flood pulse
      anomalyDesc = 'High monsoon surge event exceeding 95th historical percentile';
    } else if (dateStr === '2023-05-15' && phenomenon === 'vegetation') {
      isAnomaly = true;
      rawVal -= 0.14; // Cyclone impact / salinity intrusion
      anomalyDesc = 'Canopy defoliation event following severe tropical cyclonic disturbance';
    }

    observations.push({
      timestamp: `${dateStr}T06:00:00Z`,
      value: rawVal,
      unit,
      qualityFlag: isCloudGap ? 'cloud_masked' : 'valid',
      validObservationCount: isCloudGap ? 1 : 4,
      sourceReference: `S2A_MSIL2A_${dateStr.replace(/-/g, '')}`,
      anomaly: isAnomaly,
      anomalyDescription: anomalyDesc
    });
  });

  // Change Events
  if (phenomenon === 'vegetation') {
    changes.push({
      id: 'chg-1',
      date: '2023-05-20',
      changeType: 'abrupt_drop',
      magnitude: -0.14,
      unit: 'NDVI',
      description: 'Localized canopy stress and salt-water tidal inundation detected post-storm.',
      confidencePct: 92.4,
      affectedAreaSqKm: 84.2
    });
    changes.push({
      id: 'chg-2',
      date: '2023-11-15',
      changeType: 'rapid_growth',
      magnitude: 0.11,
      unit: 'NDVI',
      description: 'Post-monsoon mangrove foliage regeneration observed in core reserve.',
      confidencePct: 88.0,
      affectedAreaSqKm: 112.6
    });
  } else if (phenomenon === 'water') {
    changes.push({
      id: 'chg-w1',
      date: '2023-09-10',
      changeType: 'water_inundation',
      magnitude: 145.8,
      unit: 'km²',
      description: 'Peak flood discharge from Daya & Bhargabi rivers expanded northern sector water spread.',
      confidencePct: 96.1,
      affectedAreaSqKm: 145.8
    });
  } else if (phenomenon === 'urbanisation') {
    changes.push({
      id: 'chg-u1',
      date: '2022-10-10',
      changeType: 'urban_conversion',
      magnitude: 18.4,
      unit: '% Impervious',
      description: 'Conversion of fallow agrarian buffer into paved logistics and data center campus.',
      confidencePct: 94.7,
      affectedAreaSqKm: 22.1
    });
  } else if (phenomenon === 'flooding') {
    changes.push({
      id: 'chg-f1',
      date: '2023-08-15',
      changeType: 'water_inundation',
      magnitude: 275.5,
      unit: 'km²',
      description: 'Severe backwater flood inundation submerged low-lying paddy polders.',
      confidencePct: 98.2,
      affectedAreaSqKm: 275.5
    });
  }

  // Forecast Horizon (Next 6 Monthly Periods: Mar 2024 to Aug 2024)
  const forecastMonths = [
    '2024-03-15', '2024-04-15', '2024-05-15', '2024-06-15', '2024-07-15', '2024-08-15'
  ];

  forecastMonths.forEach((dateStr, fIdx) => {
    const monthNum = parseInt(dateStr.slice(5, 7), 10);
    const seasonalFactor = Math.sin(((monthNum - 3) / 12) * 2 * Math.PI);
    const stepAhead = fIdx + 1;
    
    // Model estimate
    const pred = Number((baseValue + seasonalAmp * seasonalFactor + trend * (26 + fIdx)).toFixed(3));
    
    // Growing uncertainty interval as horizon extends forward (80% and 95% confidence bands)
    const uncertainty80 = Number((0.035 + stepAhead * 0.012).toFixed(3));
    const uncertainty95 = Number((uncertainty80 * 1.55).toFixed(3));

    forecast.push({
      timestamp: `${dateStr}T06:00:00Z`,
      predictedValue: pred,
      lowerBound: Number((pred - uncertainty80).toFixed(3)),
      upperBound: Number((pred + uncertainty80).toFixed(3)),
      lowerBound95: Number((pred - uncertainty95).toFixed(3)),
      upperBound95: Number((pred + uncertainty95).toFixed(3)),
      unit,
      forecastStatus: 'forecast'
    });
  });

  // Model Metadata & Provenance (Strict Scientific Attribution)
  const forecastMetadata: ForecastModelMetadata = {
    modelId: `geo-forecast-${phenomenon}-v2`,
    modelName: phenomenon === 'urbanisation' ? 'Spatiotemporal-XGBoost BuiltUp Predictor' : 'Hybrid Seasonal-ARIMA + Sentinel Feature Regressor',
    modelVersion: 'v2.1.4-evaluated',
    algorithmFamily: phenomenon === 'urbanisation' ? 'Spatiotemporal-XGBoost' : 'Seasonal-ARIMA',
    generationDate: '2026-11-03T05:30:00Z',
    trainingWindow: {
      start: '2022-01-15T00:00:00Z',
      end: '2024-02-15T23:59:59Z'
    },
    evaluationMetrics: {
      rmse: 0.042,
      mae: 0.031,
      r2: 0.894
    },
    uncertaintyMethod: 'Residual Bootstrapping with 500 Monte Carlo Iterations & Holdout Calibration',
    limitations: [
      'Prediction assumes stationary climate forcing and no unseasonal typhoon disturbances.',
      'Cloud contamination in optical bands during peak monsoon may broaden observational error bounds.',
      'Predictions are statistical projections of aggregate surface reflectance; not deterministic event forecasts.'
    ],
    inputDataCoveragePct: 91.8,
    isSpatiotemporalLayerAvailable: true,
    warningNotice: 'DEMO / SYNTHETIC MODEL PROJECTION: For decision-support exploration only. Model outputs are mathematical estimates and should not be treated as empirical observations.'
  };

  // Map Thematic Layers
  const layers: LayerDefinition[] = [
    {
      id: 'satellite-tci',
      name: 'Sentinel-2 True Color (TCI)',
      type: 'raster_overlay',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      visible: true,
      opacity: 1.0,
      attribution: 'Copernicus Sentinel data / ESA / Esri',
      description: 'Harmonized 10m natural color surface reflectance.'
    },
    {
      id: 'thematic-index',
      name: `${indicator.toUpperCase()} Spatial Heatmap Overlay`,
      type: 'raster_overlay',
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', // Placeholder tile structure; map canvas renders synthetic colormaps on top
      visible: true,
      opacity: 0.75,
      attribution: 'BRAMHA Feature Pipeline',
      description: `Calibrated spatial distribution of ${indicator.toUpperCase()} index.`,
      legend: {
        title: indicator.toUpperCase(),
        units: unit,
        items: [
          { color: '#f7fcb9', label: 'Low (< 0.2)' },
          { color: '#addd8e', label: 'Moderate (0.4)' },
          { color: '#31a354', label: 'Healthy (0.7)' },
          { color: '#006837', label: 'Peak Dense (> 0.85)' }
        ]
      }
    },
    {
      id: 'footprints-layer',
      name: 'Satellite Scene Footprints',
      type: 'vector_footprints',
      url: '',
      visible: true,
      opacity: 0.9,
      attribution: 'ESA / NASA STAC Catalog',
      description: 'Spatial footprints and swaths of matching satellite scene products.'
    }
  ];

  return {
    observations,
    changes,
    forecast,
    forecastMetadata,
    layers
  };
}


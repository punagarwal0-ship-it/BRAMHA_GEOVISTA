import { DatasetRecord, UploadedDataset, DatasetFieldMapping, ValidationReport, GeoJSONPolygon } from '../types/api';

// Curated Earth Observation Sample Datasets for Testing & Demonstration
export const SAMPLE_DATASETS: { id: string; label: string; description: string; recordCount: number; data: string; format: 'csv' | 'geojson' | 'json' }[] = [
  {
    id: 'sample-lake-mead-ndvi',
    label: 'Lake Mead Sentinel-2 NDVI Multitemporal Series',
    description: '5 acquisitions spanning 2022 to 2024 monitoring reservoir vegetation and shoreline dynamics (Boulder Basin, NV).',
    recordCount: 5,
    format: 'csv',
    data: `record_id,timestamp,variable,value,unit,sensor,cloud_pct,preview_url
LKM-2022-04-12,2022-04-12T18:22:10Z,NDVI,0.482,index,Sentinel-2A MSI,1.2,https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&auto=format&fit=crop&q=80
LKM-2022-09-29,2022-09-29T18:20:45Z,NDVI,0.315,index,Sentinel-2B MSI,2.8,https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=600&auto=format&fit=crop&q=80
LKM-2023-05-18,2023-05-18T18:23:02Z,NDVI,0.541,index,Sentinel-2A MSI,0.4,https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=600&auto=format&fit=crop&q=80
LKM-2023-10-15,2023-10-15T18:21:19Z,NDVI,0.398,index,Sentinel-2B MSI,3.5,https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=600&auto=format&fit=crop&q=80
LKM-2024-04-06,2024-04-06T18:22:40Z,NDVI,0.564,index,Sentinel-2A MSI,0.8,https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=600&auto=format&fit=crop&q=80`
  },
  {
    id: 'sample-aral-sea-water',
    label: 'Aral Sea Landsat-9 Surface Water Dynamics',
    description: '4 seasonal acquisitions tracking water extent and NDWI index across the North Aral Basin.',
    recordCount: 4,
    format: 'csv',
    data: `record_id,timestamp,variable,value,unit,sensor,cloud_pct,preview_url
ARL-2022-06-14,2022-06-14T06:12:00Z,NDWI,0.612,index,Landsat-9 OLI-2,0.0,https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=600&auto=format&fit=crop&q=80
ARL-2022-11-20,2022-11-20T06:15:30Z,NDWI,0.485,index,Landsat-9 OLI-2,4.1,https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop&q=80
ARL-2023-06-17,2023-06-17T06:11:45Z,NDWI,0.540,index,Landsat-9 OLI-2,1.2,https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&auto=format&fit=crop&q=80
ARL-2024-05-22,2024-05-22T06:13:10Z,NDWI,0.428,index,Landsat-9 OLI-2,2.0,https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=600&auto=format&fit=crop&q=80`
  },
  {
    id: 'sample-rhone-glacier',
    label: 'Rhône Glacier Retreat Series (Swiss Alps)',
    description: '5 high-altitude observations measuring snow and ice cover fraction (Valais, Switzerland).',
    recordCount: 5,
    format: 'csv',
    data: `record_id,timestamp,variable,value,unit,sensor,cloud_pct,preview_url
RHN-2020-08-10,2020-08-10T10:30:00Z,NDSI,0.842,fraction,Sentinel-2A MSI,5.0,https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&auto=format&fit=crop&q=80
RHN-2021-08-15,2021-08-15T10:32:15Z,NDSI,0.795,fraction,Sentinel-2B MSI,2.1,https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=600&auto=format&fit=crop&q=80
RHN-2022-08-12,2022-08-12T10:29:40Z,NDSI,0.710,fraction,Sentinel-2A MSI,0.5,https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=600&auto=format&fit=crop&q=80
RHN-2023-08-20,2023-08-20T10:31:05Z,NDSI,0.684,fraction,Sentinel-2B MSI,3.8,https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&auto=format&fit=crop&q=80
RHN-2024-08-14,2024-08-14T10:30:50Z,NDSI,0.651,fraction,Sentinel-2A MSI,1.9,https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=600&auto=format&fit=crop&q=80`
  },
  {
    id: 'sample-single-record-edgecase',
    label: 'Single-Observation Test (1 Record Edge Case)',
    description: 'Specifically tests Section 4.D requirement: comparison is disabled with a helpful explanation when only 1 record exists.',
    recordCount: 1,
    format: 'csv',
    data: `record_id,timestamp,variable,value,unit,sensor,cloud_pct
SINGLE-2024-01-15,2024-01-15T12:00:00Z,NDVI,0.620,index,Sentinel-2A MSI,0.5`
  },
  {
    id: 'sample-corrupted-edgecase',
    label: 'Malformed Dataset Test (Validation Warning Edge Case)',
    description: 'Tests error and warning handling for missing timestamp fields and invalid numeric values.',
    recordCount: 3,
    format: 'csv',
    data: `record_id,sensor,notes
BAD-01,Sentinel-2A,Missing timestamp and values
BAD-02,Landsat-9,Missing columns completely
BAD-03,SAR Sentinel-1,Incomplete row`
  }
];

export class DatasetParserService {
  /**
   * Check if a file is an image (PNG, JPG, WebP, TIFF, etc.)
   */
  public static isImageFile(file: File): boolean {
    if (file.type && file.type.startsWith('image/')) return true;
    const lower = file.name.toLowerCase();
    return (
      lower.endsWith('.png') ||
      lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.webp') ||
      lower.endsWith('.tif') ||
      lower.endsWith('.tiff') ||
      lower.endsWith('.bmp')
    );
  }

  /**
   * Parse uploaded image file(s) into an UploadedDataset
   */
  public static async parseImageFiles(files: File[]): Promise<UploadedDataset> {
    if (!files || files.length === 0) {
      throw new Error('No image files provided.');
    }

    const records: DatasetRecord[] = [];
    let totalSizeBytes = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      totalSizeBytes += file.size;

      // Convert file to data URL
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error(`Failed to read file ${file.name}`));
        reader.readAsDataURL(file);
      });

      // Extract date from filename if possible, otherwise use lastModified
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      const dateMatch = file.name.match(/(\d{4})[-_.]?(\d{2})[-_.]?(\d{2})/);
      let isoDate: string;
      if (dateMatch) {
        isoDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}T12:00:00Z`;
      } else {
        isoDate = new Date(file.lastModified).toISOString();
      }

      // Infer sensor from filename
      const lower = file.name.toLowerCase();
      let sensor = 'Optical Earth Observation';
      if (lower.includes('sentinel') || lower.includes('s2')) {
        sensor = 'Sentinel-2 MSI Level-2A';
      } else if (lower.includes('landsat') || lower.includes('l8') || lower.includes('l9')) {
        sensor = 'Landsat-9 OLI-2';
      } else if (lower.includes('planet') || lower.includes('ps')) {
        sensor = 'PlanetScope 3m Ortho';
      } else if (lower.includes('drone') || lower.includes('uav')) {
        sensor = 'UAV Aerial Photogrammetry';
      }

      // Synthetic baseline index with variance for testing
      const baselineVal = Number((0.52 + (i % 5) * 0.05).toFixed(3));

      const record: DatasetRecord = {
        recordId: baseName || `IMG-PASS-${(i + 1).toString().padStart(2, '0')}`,
        timestamp: isoDate,
        variable: 'NDVI / Surface Reflectance',
        value: baselineVal,
        unit: 'index',
        assetReference: dataUrl,
        sourceReference: sensor,
        qualityFlag: 'valid',
        layerType: 'raster',
        metadata: {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          imageFilters: {
            brightness: 100,
            contrast: 100,
            saturation: 100,
            preset: 'natural',
            rotation: 0
          }
        }
      };

      records.push(record);
    }

    // Sort chronologically
    records.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const start = records[0].timestamp.slice(0, 10);
    const end = records[records.length - 1].timestamp.slice(0, 10);

    return {
      id: `ds-img-${Date.now()}`,
      name: files.length === 1 ? files[0].name : `Imagery Collection (${files.length} passes)`,
      format: 'imagery',
      sizeBytes: totalSizeBytes,
      records,
      dateRange: { start, end },
      availableVariables: ['NDVI / Surface Reflectance'],
      detectedFields: {
        idField: 'recordId',
        timeField: 'timestamp',
        valueField: 'value',
        assetField: 'assetReference',
        variableField: 'variable'
      },
      validation: {
        status: 'valid',
        totalRows: records.length,
        validRecords: records.length,
        invalidRecords: 0,
        messages: [
          `Loaded ${records.length} satellite / picture pass${records.length > 1 ? 'es' : ''} with visual previews.`
        ]
      },
      uploadedAt: new Date().toISOString()
    };
  }

  /**
   * Append one or more new image files to an existing dataset
   */
  public static async appendImageFiles(
    existingDataset: UploadedDataset,
    newFiles: File[]
  ): Promise<UploadedDataset> {
    const newDataset = await this.parseImageFiles(newFiles);
    const combinedRecords = [...existingDataset.records, ...newDataset.records];

    // Sort chronologically
    combinedRecords.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const start = combinedRecords[0]?.timestamp.slice(0, 10) || '';
    const end = combinedRecords[combinedRecords.length - 1]?.timestamp.slice(0, 10) || '';

    return {
      ...existingDataset,
      sizeBytes: existingDataset.sizeBytes + newDataset.sizeBytes,
      records: combinedRecords,
      dateRange: { start, end },
      validation: {
        status: 'valid',
        totalRows: combinedRecords.length,
        validRecords: combinedRecords.length,
        invalidRecords: 0,
        messages: [
          `Updated dataset with ${combinedRecords.length} observation records (${newFiles.length} newly added).`
        ]
      }
    };
  }

  /**
   * Main parsing entry point: handles text content from uploaded files or presets
   */
  public static parseDataset(
    name: string,
    rawText: string,
    fileSizeBytes: number,
    formatOverride?: 'csv' | 'geojson' | 'json' | 'stac' | 'imagery'
  ): UploadedDataset {
    const format = formatOverride || this.detectFormat(name, rawText);

    if (format === 'geojson' || (format === 'json' && rawText.trim().startsWith('{'))) {
      try {
        const json = JSON.parse(rawText);
        if (json.type === 'FeatureCollection' || Array.isArray(json.features)) {
          return this.parseGeoJSON(name, json, rawText, fileSizeBytes);
        }
      } catch (err) {
        // Fall back to CSV or report invalid
      }
    }

    return this.parseCSV(name, rawText, fileSizeBytes);
  }

  private static detectFormat(name: string, text: string): 'csv' | 'geojson' | 'json' | 'stac' {
    const lowerName = name.toLowerCase();
    if (lowerName.endsWith('.geojson')) return 'geojson';
    if (lowerName.endsWith('.json')) return 'json';
    if (lowerName.endsWith('.csv')) return 'csv';

    const trimmed = text.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
    return 'csv';
  }

  /**
   * Parse CSV format
   */
  public static parseCSV(name: string, rawText: string, fileSizeBytes: number): UploadedDataset {
    const lines = rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const messages: string[] = [];
    if (lines.length < 2) {
      return this.createEmptyOrInvalidDataset(
        name,
        'csv',
        fileSizeBytes,
        rawText,
        'Dataset contains no data rows or header.'
      );
    }

    const header = this.splitCSVLine(lines[0]);
    const detectedFields = this.detectColumnMapping(header);

    const records: DatasetRecord[] = [];
    const availableVariables = new Set<string>();

    for (let i = 1; i < lines.length; i++) {
      const rowValues = this.splitCSVLine(lines[i]);
      if (rowValues.length === 0) continue;

      const rowMap: Record<string, string> = {};
      header.forEach((col, idx) => {
        rowMap[col] = rowValues[idx] || '';
      });

      // Extract recordId
      const recordId =
        (detectedFields.idField && rowMap[detectedFields.idField]) ||
        `rec-${i.toString().padStart(3, '0')}`;

      // Extract timestamp
      const rawTime = detectedFields.timeField ? rowMap[detectedFields.timeField] : '';
      const parsedDate = this.validateDate(rawTime);

      // Extract value
      let numericVal: number | undefined;
      if (detectedFields.valueField && rowMap[detectedFields.valueField]) {
        const valStr = rowMap[detectedFields.valueField];
        const num = parseFloat(valStr);
        if (!isNaN(num)) {
          numericVal = num;
        }
      }

      // Extract variable
      const variable =
        (detectedFields.variableField && rowMap[detectedFields.variableField]) ||
        (detectedFields.valueField ? detectedFields.valueField.toUpperCase() : 'MEASUREMENT');
      availableVariables.add(variable);

      // Extract asset/preview reference
      const assetReference = detectedFields.assetField ? rowMap[detectedFields.assetField] : undefined;

      const record: DatasetRecord = {
        recordId,
        timestamp: parsedDate ? parsedDate.toISOString() : (rawTime || `Step ${i}`),
        variable,
        value: numericVal,
        unit: rowMap['unit'] || rowMap['units'] || 'index',
        assetReference,
        sourceReference: rowMap['sensor'] || rowMap['satellite'] || rowMap['provider'] || 'Dataset Record',
        qualityFlag: 'valid',
        metadata: {
          cloudCoverPct: rowMap['cloud_pct'] ? parseFloat(rowMap['cloud_pct']) : undefined,
          ...rowMap
        }
      };

      records.push(record);
    }

    // Sort chronologically if valid timestamps exist
    const validTimeRecords = records.filter((r) => !isNaN(new Date(r.timestamp).getTime()));
    if (validTimeRecords.length === records.length) {
      records.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }

    // Date range
    let start = '';
    let end = '';
    if (records.length > 0) {
      start = records[0].timestamp.slice(0, 10);
      end = records[records.length - 1].timestamp.slice(0, 10);
    }

    // Validation
    const totalRows = lines.length - 1;
    const validRecords = records.filter((r) => r.timestamp && r.value !== undefined).length;
    let status: 'valid' | 'warning' | 'invalid' = 'valid';

    if (records.length === 0) {
      status = 'invalid';
      messages.push('No valid records could be extracted from this dataset.');
    } else if (!detectedFields.timeField) {
      status = 'warning';
      messages.push('No explicit date/timestamp column detected. Chronological ordering is sequential.');
    } else if (records.length === 1) {
      status = 'warning';
      messages.push('Dataset contains only 1 observation. At least 2 observations are required to enable swipe comparison.');
    }

    const validation: ValidationReport = {
      status,
      totalRows,
      validRecords,
      invalidRecords: totalRows - validRecords,
      messages
    };

    return {
      id: `ds-${Date.now()}`,
      name,
      format: 'csv',
      sizeBytes: fileSizeBytes,
      rawText,
      records,
      dateRange: { start, end },
      availableVariables: Array.from(availableVariables),
      detectedFields,
      validation,
      uploadedAt: new Date().toISOString()
    };
  }

  /**
   * Parse GeoJSON FeatureCollection
   */
  public static parseGeoJSON(
    name: string,
    json: any,
    rawText: string,
    fileSizeBytes: number
  ): UploadedDataset {
    const features = Array.isArray(json.features) ? json.features : [];
    const records: DatasetRecord[] = [];
    const availableVariables = new Set<string>();
    const messages: string[] = [];

    // Detect fields from first feature properties
    const sampleProps = features[0]?.properties || {};
    const propKeys = Object.keys(sampleProps);
    const detectedFields = this.detectColumnMapping(propKeys);

    let minLon = 180;
    let minLat = 90;
    let maxLon = -180;
    let maxLat = -90;

    features.forEach((feat: any, idx: number) => {
      const props = feat.properties || {};
      const id = (detectedFields.idField && props[detectedFields.idField]) || feat.id || `feat-${idx + 1}`;
      const rawTime = detectedFields.timeField ? props[detectedFields.timeField] : '';
      const parsedDate = this.validateDate(rawTime);

      let numericVal: number | undefined;
      if (detectedFields.valueField && props[detectedFields.valueField] !== undefined) {
        const num = parseFloat(props[detectedFields.valueField]);
        if (!isNaN(num)) numericVal = num;
      }

      const variable =
        (detectedFields.variableField && props[detectedFields.variableField]) ||
        (detectedFields.valueField ? detectedFields.valueField.toUpperCase() : 'MEASUREMENT');
      availableVariables.add(variable);

      const record: DatasetRecord = {
        recordId: String(id),
        timestamp: parsedDate ? parsedDate.toISOString() : (rawTime || `Feature ${idx + 1}`),
        variable,
        value: numericVal,
        unit: props.unit || props.units || 'index',
        assetReference: detectedFields.assetField ? props[detectedFields.assetField] : undefined,
        sourceReference: props.sensor || props.satellite || 'GeoJSON Dataset',
        qualityFlag: 'valid',
        geometryOrExtent: feat.geometry as GeoJSONPolygon,
        metadata: props
      };

      records.push(record);
    });

    // Sort chronologically if timestamps are valid
    records.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    let start = '';
    let end = '';
    if (records.length > 0) {
      start = records[0].timestamp.slice(0, 10);
      end = records[records.length - 1].timestamp.slice(0, 10);
    }

    const validation: ValidationReport = {
      status: records.length >= 2 ? 'valid' : 'warning',
      totalRows: features.length,
      validRecords: records.length,
      invalidRecords: 0,
      messages: records.length === 1 ? ['Only 1 record found. Comparison requires at least 2 records.'] : []
    };

    return {
      id: `ds-${Date.now()}`,
      name,
      format: 'geojson',
      sizeBytes: fileSizeBytes,
      rawText,
      records,
      dateRange: { start, end },
      availableVariables: Array.from(availableVariables),
      detectedFields,
      validation,
      uploadedAt: new Date().toISOString()
    };
  }

  /**
   * Re-map fields when user changes assignments in DatasetFieldMapper
   */
  public static remapDataset(
    dataset: UploadedDataset,
    newMapping: DatasetFieldMapping
  ): UploadedDataset {
    if (!dataset.rawText) return dataset;
    const remapped = this.parseDataset(dataset.name, dataset.rawText, dataset.sizeBytes, dataset.format);
    remapped.detectedFields = newMapping;

    // Apply new mapping values
    remapped.records.forEach((rec, idx) => {
      const meta = rec.metadata || {};
      if (newMapping.idField && meta[newMapping.idField]) {
        rec.recordId = String(meta[newMapping.idField]);
      }
      if (newMapping.timeField && meta[newMapping.timeField]) {
        const parsed = this.validateDate(meta[newMapping.timeField]);
        rec.timestamp = parsed ? parsed.toISOString() : meta[newMapping.timeField];
      }
      if (newMapping.valueField && meta[newMapping.valueField] !== undefined) {
        const num = parseFloat(meta[newMapping.valueField]);
        if (!isNaN(num)) rec.value = num;
      }
      if (newMapping.assetField && meta[newMapping.assetField]) {
        rec.assetReference = meta[newMapping.assetField];
      }
    });

    return remapped;
  }

  // Helper: Detect column names by fuzzy matching
  private static detectColumnMapping(columns: string[]): DatasetFieldMapping {
    const lowerCols = columns.map((c) => ({ original: c, lower: c.toLowerCase().trim() }));

    const timeMatches = ['timestamp', 'date', 'datetime', 'acquired_at', 'acquiredat', 'time', 'date_time', 'observation_date', 'year'];
    const valueMatches = ['value', 'ndvi', 'ndwi', 'ndsi', 'measurement', 'index', 'val', 'magnitude', 'mean', 'metric', 'cover', 'fraction'];
    const idMatches = ['record_id', 'recordid', 'id', 'product_id', 'productid', 'scene_id', 'name'];
    const assetMatches = ['preview_url', 'preview', 'thumbnail', 'asset', 'asset_reference', 'image', 'url', 'href'];
    const variableMatches = ['variable', 'indicator', 'band', 'parameter', 'metric_name'];

    const findMatch = (candidates: string[]) => {
      for (const cand of candidates) {
        const found = lowerCols.find((c) => c.lower === cand || c.lower.includes(cand));
        if (found) return found.original;
      }
      return '';
    };

    return {
      idField: findMatch(idMatches) || (columns[0] || ''),
      timeField: findMatch(timeMatches) || '',
      valueField: findMatch(valueMatches) || '',
      assetField: findMatch(assetMatches) || '',
      variableField: findMatch(variableMatches) || ''
    };
  }

  // Helper: validate and parse date string
  private static validateDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }

  // Helper: simple CSV line splitter handling basic quotes
  private static splitCSVLine(line: string): string[] {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur.trim());
    return result;
  }

  private static createEmptyOrInvalidDataset(
    name: string,
    format: 'csv' | 'geojson' | 'json' | 'imagery',
    sizeBytes: number,
    rawText: string,
    errorMsg: string
  ): UploadedDataset {
    return {
      id: `ds-${Date.now()}`,
      name,
      format,
      sizeBytes,
      rawText,
      records: [],
      dateRange: { start: '', end: '' },
      availableVariables: [],
      detectedFields: { idField: '', timeField: '', valueField: '', assetField: '', variableField: '' },
      validation: {
        status: 'invalid',
        totalRows: 0,
        validRecords: 0,
        invalidRecords: 0,
        messages: [errorMsg]
      },
      uploadedAt: new Date().toISOString()
    };
  }
}

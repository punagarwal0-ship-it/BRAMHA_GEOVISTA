import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sliders,
  Calendar,
  Layers,
  RotateCw,
  RotateCcw,
  RefreshCw,
  Trash2,
  Check,
  Upload,
  Eye,
  Sparkles,
  Tag,
  Hash
} from 'lucide-react';
import { DatasetRecord } from '../types/api';

interface DatasetRecordEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: DatasetRecord | null;
  onSave: (updated: DatasetRecord) => void;
  onDelete?: (recordId: string) => void;
}

export const DatasetRecordEditorModal: React.FC<DatasetRecordEditorModalProps> = ({
  isOpen,
  onClose,
  record,
  onSave,
  onDelete
}) => {
  if (!isOpen || !record) return null;

  // Form Fields
  const [recordId, setRecordId] = useState(record.recordId);
  const [timestamp, setTimestamp] = useState(record.timestamp.slice(0, 10));
  const [timeExact, setTimeExact] = useState(
    record.timestamp.includes('T') ? record.timestamp.split('T')[1].replace('Z', '').slice(0, 5) : '12:00'
  );
  const [sensor, setSensor] = useState(record.sourceReference || 'Optical Satellite Pass');
  const [variable, setVariable] = useState(record.variable || 'NDVI');
  const [value, setValue] = useState<string>(
    record.value !== undefined ? String(record.value) : '0.500'
  );
  const [unit, setUnit] = useState(record.unit || 'index');
  const [qualityFlag, setQualityFlag] = useState(record.qualityFlag || 'valid');
  const [notes, setNotes] = useState(record.metadata?.notes || '');
  const [assetReference, setAssetReference] = useState<string | undefined>(record.assetReference);

  // Visual Image Adjustments
  const initialFilters = record.metadata?.imageFilters || {
    brightness: 100,
    contrast: 100,
    saturation: 100,
    preset: 'natural',
    rotation: 0
  };

  const [brightness, setBrightness] = useState<number>(initialFilters.brightness ?? 100);
  const [contrast, setContrast] = useState<number>(initialFilters.contrast ?? 100);
  const [saturation, setSaturation] = useState<number>(initialFilters.saturation ?? 100);
  const [preset, setPreset] = useState<string>(initialFilters.preset ?? 'natural');
  const [rotation, setRotation] = useState<number>(initialFilters.rotation ?? 0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset form when record changes
  useEffect(() => {
    if (record) {
      setRecordId(record.recordId);
      setTimestamp(record.timestamp.slice(0, 10));
      setTimeExact(
        record.timestamp.includes('T') ? record.timestamp.split('T')[1].replace('Z', '').slice(0, 5) : '12:00'
      );
      setSensor(record.sourceReference || 'Optical Satellite Pass');
      setVariable(record.variable || 'NDVI');
      setValue(record.value !== undefined ? String(record.value) : '0.500');
      setUnit(record.unit || 'index');
      setQualityFlag(record.qualityFlag || 'valid');
      setNotes(record.metadata?.notes || '');
      setAssetReference(record.assetReference);

      const filters = record.metadata?.imageFilters || {
        brightness: 100,
        contrast: 100,
        saturation: 100,
        preset: 'natural',
        rotation: 0
      };
      setBrightness(filters.brightness ?? 100);
      setContrast(filters.contrast ?? 100);
      setSaturation(filters.saturation ?? 100);
      setPreset(filters.preset ?? 'natural');
      setRotation(filters.rotation ?? 0);
    }
  }, [record]);

  // Compute CSS filter string based on adjustments and preset
  const getFilterStyle = () => {
    let base = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
    switch (preset) {
      case 'ndvi':
        // Simulates false-color infrared/NDVI enhancement
        return `${base} contrast(135%) saturate(190%) hue-rotate(50deg)`;
      case 'ndwi':
        // Simulates moisture/water absorption cyan enhancement
        return `${base} contrast(130%) saturate(180%) hue-rotate(175deg)`;
      case 'thermal':
        // Grayscale thermal reflectance
        return `${base} grayscale(100%) contrast(145%)`;
      case 'invert':
        // Anomaly edge detection
        return `${base} invert(100%)`;
      default:
        return base;
    }
  };

  const handleRotateCW = () => setRotation((r) => (r + 90) % 360);
  const handleRotateCCW = () => setRotation((r) => (r - 90 + 360) % 360);

  const handleResetFilters = () => {
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setPreset('natural');
    setRotation(0);
  };

  // Replace image file handler
  const handleImageReplace = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setAssetReference(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    const numVal = parseFloat(value);
    const combinedTimestamp = `${timestamp}T${timeExact}:00Z`;

    const updatedRecord: DatasetRecord = {
      ...record,
      recordId: recordId.trim() || record.recordId,
      timestamp: combinedTimestamp,
      variable: variable.trim() || 'NDVI',
      value: !isNaN(numVal) ? numVal : record.value,
      unit: unit.trim() || 'index',
      sourceReference: sensor.trim(),
      qualityFlag,
      assetReference,
      metadata: {
        ...record.metadata,
        notes,
        imageFilters: {
          brightness,
          contrast,
          saturation,
          preset,
          rotation
        }
      }
    };

    onSave(updatedRecord);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-paper-deep/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-paper-2 border border-rule rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-rule shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-control bg-paper-3 border border-rule flex items-center justify-center text-ink">
              <Sliders className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
                <span>Edit Picture & Observation Record</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-paper-3 text-muted-2 font-mono border border-rule">
                  {recordId}
                </span>
              </h2>
              <p className="text-xs text-muted">
                Adjust satellite image calibration, metadata timestamps, and observed biophysical values.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-control text-muted hover:text-ink hover:bg-paper-3 flex items-center justify-center transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body: Split 2-Column Layout */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-6 text-xs">
          {/* Left Column: Visual Image Adjustment Studio */}
          <div className="md:col-span-6 space-y-4 flex flex-col">
            <div className="flex items-center justify-between">
              <span className="font-medium text-ink flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-muted-2" />
                <span>Visual preview & image adjustments</span>
              </span>
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-[11px] text-muted hover:text-ink flex items-center gap-1 transition-colors"
                title="Reset adjustments to default"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Reset adjustments</span>
              </button>
            </div>

            {/* Picture Preview Frame with Applied CSS Filters */}
            <div className="relative h-64 bg-paper-deep rounded-xl border border-rule overflow-hidden flex items-center justify-center group shadow-inner">
              {assetReference ? (
                <div
                  className="w-full h-full flex items-center justify-center transition-transform duration-200"
                  style={{ transform: `rotate(${rotation}deg)` }}
                >
                  <img
                    src={assetReference}
                    alt={recordId}
                    style={{ filter: getFilterStyle() }}
                    className="max-h-full max-w-full object-contain transition-all duration-150 select-none"
                  />
                </div>
              ) : (
                <div className="text-center p-4 space-y-2">
                  <Layers className="h-8 w-8 mx-auto text-muted-2" />
                  <p className="text-muted">No picture attached to this record.</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-control bg-paper-3 hover:bg-paper-surface border border-rule text-ink text-xs inline-flex items-center gap-1.5"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>Upload image picture</span>
                  </button>
                </div>
              )}

              {/* Quick Rotation Buttons Floating on Preview */}
              {assetReference && (
                <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-paper-deep/80 backdrop-blur-sm p-1 rounded-control border border-rule">
                  <button
                    type="button"
                    onClick={handleRotateCCW}
                    className="h-6 w-6 rounded flex items-center justify-center text-muted hover:text-ink hover:bg-paper-3 transition-colors"
                    title="Rotate 90° CCW"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleRotateCW}
                    className="h-6 w-6 rounded flex items-center justify-center text-muted hover:text-ink hover:bg-paper-3 transition-colors"
                    title="Rotate 90° CW"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-6 px-2 rounded flex items-center gap-1 text-[11px] text-muted hover:text-ink hover:bg-paper-3 transition-colors"
                    title="Replace picture"
                  >
                    <Upload className="h-3 w-3" />
                    <span>Replace</span>
                  </button>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageReplace}
              />
            </div>

            {/* Filter Presets Bar */}
            <div className="space-y-1.5">
              <label className="text-[11px] text-muted-2 font-medium">Spectral Filter Preset</label>
              <div className="grid grid-cols-5 gap-1">
                {[
                  { id: 'natural', label: 'True color' },
                  { id: 'ndvi', label: 'NDVI false' },
                  { id: 'ndwi', label: 'Water index' },
                  { id: 'thermal', label: 'Thermal' },
                  { id: 'invert', label: 'Invert' }
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPreset(item.id)}
                    className={`h-[28px] text-[11px] font-medium rounded-control border transition-colors truncate px-1.5 ${
                      preset === item.id
                        ? 'bg-paper-surface border-rule-2 text-ink shadow-sm'
                        : 'bg-paper-3 border-rule text-muted hover:text-ink hover:bg-paper-surface/50'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sliders: Brightness, Contrast, Saturation */}
            <div className="space-y-2.5 p-3 bg-paper-3 rounded-xl border border-rule">
              <div>
                <div className="flex justify-between items-center text-[11px] text-muted mb-1">
                  <span>Brightness</span>
                  <span className="font-mono tabular-nums text-ink">{brightness}%</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="180"
                  value={brightness}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                  className="w-full h-1 bg-paper-surface accent-ink cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between items-center text-[11px] text-muted mb-1">
                  <span>Contrast</span>
                  <span className="font-mono tabular-nums text-ink">{contrast}%</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="200"
                  value={contrast}
                  onChange={(e) => setContrast(Number(e.target.value))}
                  className="w-full h-1 bg-paper-surface accent-ink cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between items-center text-[11px] text-muted mb-1">
                  <span>Saturation</span>
                  <span className="font-mono tabular-nums text-ink">{saturation}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="220"
                  value={saturation}
                  onChange={(e) => setSaturation(Number(e.target.value))}
                  className="w-full h-1 bg-paper-surface accent-ink cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Right Column: Observation Metadata & Biophysical Values */}
          <div className="md:col-span-6 space-y-3.5 flex flex-col justify-between">
            <div className="space-y-3">
              <span className="font-medium text-ink flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-muted-2" />
                <span>Observation attributes & biophysical values</span>
              </span>

              {/* Record ID / Granule Name */}
              <div>
                <label className="text-[11px] text-muted-2 block mb-1">Record ID / Pass Granule</label>
                <input
                  type="text"
                  value={recordId}
                  onChange={(e) => setRecordId(e.target.value)}
                  placeholder="e.g. PASS-2024-04-12-AOI"
                  className="w-full h-[34px] bg-paper-3 rounded-control border border-rule px-3 text-ink text-xs focus:border-ink-2 outline-none font-mono"
                />
              </div>

              {/* Date & Time Acquisition */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-muted-2 block mb-1">Acquisition date</label>
                  <input
                    type="date"
                    value={timestamp}
                    onChange={(e) => setTimestamp(e.target.value)}
                    className="w-full h-[34px] bg-paper-3 rounded-control border border-rule px-2.5 text-ink text-xs focus:border-ink-2 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-2 block mb-1">Time (UTC)</label>
                  <input
                    type="time"
                    value={timeExact}
                    onChange={(e) => setTimeExact(e.target.value)}
                    className="w-full h-[34px] bg-paper-3 rounded-control border border-rule px-2.5 text-ink text-xs focus:border-ink-2 outline-none font-mono"
                  />
                </div>
              </div>

              {/* Sensor / Source Reference */}
              <div>
                <label className="text-[11px] text-muted-2 block mb-1">Sensor / Platform</label>
                <input
                  type="text"
                  value={sensor}
                  onChange={(e) => setSensor(e.target.value)}
                  placeholder="e.g. Sentinel-2A MSI, Landsat-9, UAV Drone"
                  className="w-full h-[34px] bg-paper-3 rounded-control border border-rule px-3 text-ink text-xs focus:border-ink-2 outline-none"
                />
              </div>

              {/* Observed Variable, Numeric Value & Unit */}
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-5">
                  <label className="text-[11px] text-muted-2 block mb-1">Variable</label>
                  <input
                    type="text"
                    value={variable}
                    onChange={(e) => setVariable(e.target.value)}
                    placeholder="NDVI"
                    className="w-full h-[34px] bg-paper-3 rounded-control border border-rule px-2.5 text-ink text-xs focus:border-ink-2 outline-none uppercase font-mono"
                  />
                </div>
                <div className="col-span-4">
                  <label className="text-[11px] text-muted-2 block mb-1">Observed Value</label>
                  <input
                    type="number"
                    step="0.001"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="w-full h-[34px] bg-paper-3 rounded-control border border-rule px-2.5 text-ink text-xs focus:border-ink-2 outline-none font-mono tabular-nums font-medium"
                  />
                </div>
                <div className="col-span-3">
                  <label className="text-[11px] text-muted-2 block mb-1">Unit</label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="index"
                    className="w-full h-[34px] bg-paper-3 rounded-control border border-rule px-2 text-ink text-xs focus:border-ink-2 outline-none"
                  />
                </div>
              </div>

              {/* Quality Flag */}
              <div>
                <label className="text-[11px] text-muted-2 block mb-1">Observation Quality Flag</label>
                <select
                  value={qualityFlag}
                  onChange={(e) => setQualityFlag(e.target.value)}
                  className="w-full h-[34px] bg-paper-3 rounded-control border border-rule px-2.5 text-ink text-xs focus:border-ink-2 outline-none"
                >
                  <option value="valid">Valid (Calibrated surface pass)</option>
                  <option value="cloud_masked">Cloud masked / Atmospheric haze</option>
                  <option value="shadow_masked">Terrain shadow masked</option>
                  <option value="interpolated_warning">Interpolated / Model projected</option>
                </select>
              </div>

              {/* Notes / Remarks */}
              <div>
                <label className="text-[11px] text-muted-2 block mb-1">Field notes & remarks</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes about ground conditions, calibration parameters, or target phenomena…"
                  className="w-full p-2.5 bg-paper-3 rounded-control border border-rule text-ink text-xs focus:border-ink-2 outline-none resize-none leading-relaxed"
                />
              </div>
            </div>

            {/* Quick delete option if handler provided */}
            {onDelete && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Delete observation record "${recordId}" from this dataset?`)) {
                      onDelete(record.recordId);
                      onClose();
                    }
                  }}
                  className="text-[11px] text-muted hover:text-error flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5 text-error" />
                  <span>Remove this picture / pass from dataset</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 bg-paper-3 border-t border-rule flex items-center justify-between shrink-0">
          <div className="text-[11px] text-muted">
            Changes apply to time series charts and swipe comparisons.
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-[34px] px-4 rounded-control bg-paper-2 hover:bg-paper-surface border border-rule text-muted hover:text-ink transition-colors font-medium text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="h-[34px] px-5 rounded-control bg-ink hover:bg-ink/90 text-paper font-medium text-xs transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Save Record & Picture</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


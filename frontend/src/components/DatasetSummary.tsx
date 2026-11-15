import React, { useRef } from 'react';
import {
  FileText,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sliders,
  Trash2,
  Database,
  Image as ImageIcon,
  Plus,
  Edit2,
  Clock,
  Sparkles
} from 'lucide-react';
import { UploadedDataset, DatasetRecord } from '../types/api';

interface DatasetSummaryProps {
  dataset: UploadedDataset;
  onOpenFieldMapper: () => void;
  onClearDataset: () => void;
  onEditRecord?: (record: DatasetRecord) => void;
  onAddPictures?: (files: FileList | File[]) => void;
  onDeleteRecord?: (recordId: string) => void;
}

export const DatasetSummary: React.FC<DatasetSummaryProps> = ({
  dataset,
  onOpenFieldMapper,
  onClearDataset,
  onEditRecord,
  onAddPictures,
  onDeleteRecord
}) => {
  const addFileInputRef = useRef<HTMLInputElement>(null);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isValid = dataset.validation.status === 'valid';
  const isWarning = dataset.validation.status === 'warning';
  const isInvalid = dataset.validation.status === 'invalid';

  // Helper to compute CSS filter style for thumbnails
  const getThumbnailFilter = (record: DatasetRecord) => {
    const filters = record.metadata?.imageFilters;
    if (!filters) return undefined;

    let base = `brightness(${filters.brightness ?? 100}%) contrast(${filters.contrast ?? 100}%) saturate(${filters.saturation ?? 100}%)`;
    switch (filters.preset) {
      case 'ndvi':
        return `${base} contrast(135%) saturate(190%) hue-rotate(50deg)`;
      case 'ndwi':
        return `${base} contrast(130%) saturate(180%) hue-rotate(175deg)`;
      case 'thermal':
        return `${base} grayscale(100%) contrast(145%)`;
      case 'invert':
        return `${base} invert(100%)`;
      default:
        return base;
    }
  };

  return (
    <div className="p-3 bg-paper-3 rounded-card border border-rule space-y-3 text-xs">
      {/* Header with Title and Clear Action */}
      <div className="flex items-center justify-between border-b border-rule pb-2">
        <div className="flex items-center space-x-2">
          {dataset.format === 'imagery' ? (
            <ImageIcon className="h-4 w-4 text-ink-2" aria-hidden="true" />
          ) : (
            <Database className="h-4 w-4 text-ink-2" aria-hidden="true" />
          )}
          <span className="font-medium text-ink truncate max-w-[200px]" title={dataset.name}>
            {dataset.name}
          </span>
        </div>
        <button
          onClick={onClearDataset}
          className="h-[34px] w-[34px] flex items-center justify-center rounded-control text-muted hover:text-error transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus"
          title="Remove dataset"
          aria-label="Remove dataset"
        >
          <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        </button>
      </div>

      {/* Validation Status Badge */}
      <div
        className={`p-2.5 rounded-control border flex items-start space-x-2 ${
          isValid
            ? 'bg-success/10 border-success/30 text-success'
            : isWarning
            ? 'bg-warning/10 border-warning/30 text-warning'
            : 'bg-error/10 border-error/30 text-error'
        }`}
      >
        {isValid && <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />}
        {isWarning && <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />}
        {isInvalid && <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />}
        <div className="space-y-0.5">
          <div className="font-medium text-xs">
            {isValid && (dataset.format === 'imagery' ? 'Imagery passes calibrated' : 'Dataset schema validated')}
            {isWarning && 'Validation advisory'}
            {isInvalid && 'Validation failure'}
          </div>
          {dataset.validation.messages.map((msg, i) => (
            <p key={i} className="text-xs leading-tight">
              {msg}
            </p>
          ))}
        </div>
      </div>

      {/* Key Inspection Metrics Grid */}
      <div className="grid grid-cols-2 gap-2 font-mono tabular-nums text-xs">
        <div className="bg-paper p-2 rounded-control border border-rule">
          <span className="text-muted block text-xs font-sans">Format & size</span>
          <span className="text-ink font-medium capitalize">{dataset.format}</span>
          <span className="text-muted-2 text-xs ml-1">({formatSize(dataset.sizeBytes)})</span>
        </div>

        <div className="bg-paper p-2 rounded-control border border-rule">
          <span className="text-muted block text-xs font-sans">Observations / Passes</span>
          <span className="text-ink font-medium">
            {dataset.records.length}{' '}
            <span className="text-xs text-muted-2 font-sans">records</span>
          </span>
        </div>

        <div className="bg-paper p-2 rounded-control border border-rule col-span-2">
          <span className="text-muted block text-xs font-sans">Temporal span</span>
          <div className="flex items-center space-x-1.5 text-ink font-medium text-xs">
            <Calendar className="h-4 w-4 text-muted-2 shrink-0" aria-hidden="true" />
            <span>
              {dataset.dateRange.start ? dataset.dateRange.start : 'Undated'} to{' '}
              {dataset.dateRange.end ? dataset.dateRange.end : 'Undated'}
            </span>
          </div>
        </div>

        {dataset.availableVariables.length > 0 && (
          <div className="bg-paper p-2 rounded-control border border-rule col-span-2">
            <span className="text-muted block text-xs font-sans">Observed variables</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {dataset.availableVariables.map((v) => (
                <span
                  key={v}
                  className="px-1.5 py-0.5 bg-paper-2 rounded-sm border border-rule text-ink text-xs font-mono"
                >
                  {v}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Picture & Observation Passes List with Edit Actions */}
      <div className="space-y-2 pt-1 border-t border-rule">
        <div className="flex items-center justify-between">
          <span className="font-medium text-ink flex items-center gap-1.5">
            <ImageIcon className="h-3.5 w-3.5 text-muted-2" />
            <span>Passes & Observation Records</span>
          </span>
          <button
            type="button"
            onClick={() => addFileInputRef.current?.click()}
            className="text-[11px] text-muted hover:text-ink font-medium flex items-center gap-1 px-2 py-0.5 rounded-control bg-paper hover:bg-paper-surface border border-rule transition-colors"
          >
            <Plus className="h-3 w-3" />
            <span>Add picture</span>
          </button>
        </div>

        {/* Hidden File Input for Adding Pictures */}
        <input
          ref={addFileInputRef}
          type="file"
          multiple
          accept=".png,.jpg,.jpeg,.webp,.tif,.tiff,.bmp"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0 && onAddPictures) {
              onAddPictures(e.target.files);
            }
          }}
        />

        {/* Records Gallery List */}
        <div className="max-h-56 overflow-y-auto space-y-1.5 pr-0.5 font-mono tabular-nums text-xs">
          {dataset.records.map((r, idx) => (
            <div
              key={r.recordId || idx}
              className="p-2 bg-paper rounded-control border border-rule flex items-center justify-between gap-2 hover:border-rule-2 transition-colors group"
            >
              {/* Left: Thumbnail & Info */}
              <div className="flex items-center gap-2.5 min-w-0">
                {r.assetReference ? (
                  <div
                    className="h-9 w-9 rounded-sm bg-paper-deep border border-rule shrink-0 overflow-hidden flex items-center justify-center"
                    style={{
                      transform: r.metadata?.imageFilters?.rotation
                        ? `rotate(${r.metadata.imageFilters.rotation}deg)`
                        : undefined
                    }}
                  >
                    <img
                      src={r.assetReference}
                      alt={r.recordId}
                      style={{ filter: getThumbnailFilter(r) }}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="h-9 w-9 rounded-sm bg-paper-3 border border-rule shrink-0 flex items-center justify-center text-muted-2">
                    <FileText className="h-4 w-4" />
                  </div>
                )}

                <div className="min-w-0">
                  <div className="text-ink font-medium truncate max-w-[130px]" title={r.recordId}>
                    {r.recordId}
                  </div>
                  <div className="text-[11px] text-muted-2 flex items-center gap-1.5 font-sans">
                    <span>{r.timestamp.slice(0, 10)}</span>
                    {r.value !== undefined && (
                      <span className="text-ink font-mono font-medium">
                        • {r.value.toFixed(2)} {r.unit}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Quick Edit / Delete Buttons */}
              <div className="flex items-center gap-1 shrink-0">
                {onEditRecord && (
                  <button
                    type="button"
                    onClick={() => onEditRecord(r)}
                    className="h-7 px-2 rounded-control bg-paper-2 hover:bg-paper-surface border border-rule text-muted hover:text-ink text-[11px] font-sans flex items-center gap-1 transition-colors"
                    title="Edit picture adjustments, timestamp & values"
                  >
                    <Edit2 className="h-3 w-3" />
                    <span>Edit</span>
                  </button>
                )}
                {onDeleteRecord && dataset.records.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Delete record "${r.recordId}"?`)) {
                        onDeleteRecord(r.recordId);
                      }
                    }}
                    className="h-7 w-7 rounded-control text-muted hover:text-error hover:bg-paper-2 flex items-center justify-center transition-colors"
                    title="Delete record"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons: Column mapper if structured data, or Add Pictures */}
      {dataset.format !== 'imagery' && (
        <button
          onClick={onOpenFieldMapper}
          className="w-full h-[34px] px-3 bg-paper-2 hover:bg-paper-surface border border-rule text-muted hover:text-ink text-xs rounded-control transition-colors flex items-center justify-center space-x-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus"
        >
          <Sliders className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Reassign dataset column mappings</span>
        </button>
      )}
    </div>
  );
};

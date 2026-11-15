import React, { useState } from 'react';
import {
  SplitSquareVertical,
  Calendar,
  Layers,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ArrowLeftRight,
  RotateCcw,
  AlertCircle,
  Upload,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Sliders,
  Image as ImageIcon
} from 'lucide-react';
import { DatasetRecord, UploadedDataset } from '../types/api';

interface DatasetCompareViewerProps {
  dataset: UploadedDataset | null;
  selectedRecordA: DatasetRecord | null;
  selectedRecordB: DatasetRecord | null;
  onSelectRecordA: (record: DatasetRecord) => void;
  onSelectRecordB: (record: DatasetRecord) => void;
  compareMode: boolean;
  setCompareMode: (active: boolean) => void;
  swipePosition: number;
  setSwipePosition: (pos: number) => void;
  onNavigateToUpload: () => void;
  onEditRecord?: (record: DatasetRecord) => void;
}

export const DatasetCompareViewer: React.FC<DatasetCompareViewerProps> = ({
  dataset,
  selectedRecordA,
  selectedRecordB,
  onSelectRecordA,
  onSelectRecordB,
  compareMode,
  setCompareMode,
  swipePosition,
  setSwipePosition,
  onNavigateToUpload,
  onEditRecord
}) => {
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

  // Case 1: No dataset uploaded
  if (!dataset || dataset.records.length === 0) {
    return (
      <div className="p-4 bg-paper-3 rounded-card border border-rule space-y-3 text-xs text-center">
        <div className="h-10 w-10 mx-auto rounded-control bg-paper-2 border border-rule flex items-center justify-center text-muted">
          <Upload className="h-5 w-5 text-ink-2" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <div className="font-medium text-ink">No comparison dataset uploaded</div>
          <p className="text-xs text-muted max-w-xs mx-auto">
            The comparison viewer is strictly populated from uploaded dataset records. Upload a multi-temporal dataset or choose a sample to inspect changes.
          </p>
        </div>
        <button
          onClick={onNavigateToUpload}
          className="px-3 py-1.5 bg-paper-surface hover:bg-paper-surface-hover text-ink font-medium text-xs rounded-control border border-rule transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus inline-flex items-center space-x-1.5"
        >
          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Upload or choose dataset</span>
        </button>
      </div>
    );
  }

  // Case 2: Exactly 1 record available (Section 4.D edge case requirement)
  if (dataset.records.length === 1) {
    const singleRec = dataset.records[0];
    return (
      <div className="p-4 bg-paper-3 rounded-card border border-rule space-y-3 text-xs">
        <div className="p-3 bg-warning/10 border border-warning/30 rounded-control text-warning flex items-start space-x-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <div className="font-medium">Single observation detected</div>
            <p className="text-xs text-muted leading-relaxed">
              Comparison requires at least two distinct observations in the dataset. This record is displayed below for analytical inspection.
            </p>
          </div>
        </div>

        <div className="p-3 bg-paper rounded-control border border-rule space-y-2">
          <div className="flex justify-between items-center border-b border-rule pb-1.5 font-mono tabular-nums text-xs">
            <span className="text-muted">Observation ID</span>
            <span className="text-ink font-medium">{singleRec.recordId}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted">Timestamp</span>
            <span className="text-ink font-mono tabular-nums">{singleRec.timestamp.slice(0, 10)}</span>
          </div>
          {singleRec.value !== undefined && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted">Observed value</span>
              <span className="text-ink font-mono tabular-nums font-medium">
                {singleRec.value.toFixed(3)} {singleRec.unit}
              </span>
            </div>
          )}
        </div>

        <button
          onClick={onNavigateToUpload}
          className="w-full py-2 bg-paper-2 hover:bg-paper-surface border border-rule text-muted hover:text-ink text-xs rounded-control whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus"
        >
          Choose another dataset
        </button>
      </div>
    );
  }

  // Case 3: 2 or more records available (Normal Comparison Flow)
  const validRecords = dataset.records;
  const indexA = selectedRecordA ? validRecords.findIndex((r) => r.recordId === selectedRecordA.recordId) : 0;
  const indexB = selectedRecordB ? validRecords.findIndex((r) => r.recordId === selectedRecordB.recordId) : validRecords.length - 1;

  // Swap sides handler
  const handleSwapSides = () => {
    if (selectedRecordA && selectedRecordB) {
      const temp = selectedRecordA;
      onSelectRecordA(selectedRecordB);
      onSelectRecordB(temp);
    }
  };

  // Step controls
  const handleStepPrev = () => {
    if (indexB > 0) {
      onSelectRecordB(validRecords[indexB - 1]);
    }
  };

  const handleStepNext = () => {
    if (indexB < validRecords.length - 1) {
      onSelectRecordB(validRecords[indexB + 1]);
    }
  };

  // Delta calculation
  let valDelta: number | null = null;
  let pctDelta: number | null = null;
  if (
    selectedRecordA &&
    selectedRecordB &&
    selectedRecordA.value !== undefined &&
    selectedRecordB.value !== undefined
  ) {
    valDelta = selectedRecordB.value - selectedRecordA.value;
    if (selectedRecordA.value !== 0) {
      pctDelta = (valDelta / Math.abs(selectedRecordA.value)) * 100;
    }
  }

  // Calculate day difference
  let daysDiff: number | null = null;
  if (selectedRecordA && selectedRecordB) {
    const tA = new Date(selectedRecordA.timestamp).getTime();
    const tB = new Date(selectedRecordB.timestamp).getTime();
    if (!isNaN(tA) && !isNaN(tB)) {
      daysDiff = Math.abs(Math.round((tB - tA) / (1000 * 60 * 60 * 24)));
    }
  }

  return (
    <div className="space-y-4 text-xs">
      {/* Header & Mode Toggle */}
      <div className="flex items-center justify-between border-b border-rule pb-2">
        <div className="flex items-center space-x-2">
          <SplitSquareVertical className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
          <span className="font-medium text-ink">Dataset swipe compare</span>
        </div>

        <button
          onClick={() => setCompareMode(!compareMode)}
          className={`h-[34px] px-3 rounded-control text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus ${
            compareMode
              ? 'bg-ink text-paper shadow-sm'
              : 'bg-paper-2 hover:bg-paper-surface border border-rule text-muted hover:text-ink'
          }`}
        >
          {compareMode ? 'Swipe active' : 'Enable swipe'}
        </button>
      </div>

      {/* Dataset Provenance Notice */}
      <div className="h-[34px] px-3 bg-paper rounded-control border border-rule text-xs text-muted flex items-center justify-between font-mono tabular-nums">
        <span className="truncate max-w-[170px]" title={dataset.name}>
          {dataset.name}
        </span>
        <span className="text-ink">{validRecords.length} records</span>
      </div>

      {/* Record A Selector (Reference) */}
      <div className="p-3 bg-paper-3 rounded-card border border-rule space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-medium text-ink flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-ink-2" />
            <span>Reference record (side A)</span>
          </span>
          <span className="text-xs font-mono tabular-nums text-muted-2">
            Index {indexA + 1} of {validRecords.length}
          </span>
        </div>

        <select
          value={selectedRecordA?.recordId || ''}
          onChange={(e) => {
            const found = validRecords.find((r) => r.recordId === e.target.value);
            if (found) onSelectRecordA(found);
          }}
          className="w-full h-[34px] bg-paper border border-rule px-2 text-ink text-xs rounded-control focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus font-mono tabular-nums"
        >
          {validRecords.map((rec) => (
            <option key={rec.recordId} value={rec.recordId}>
              {rec.timestamp.slice(0, 10)} : {rec.recordId}
              {rec.value !== undefined ? ` (${rec.value.toFixed(2)} ${rec.unit})` : ''}
            </option>
          ))}
        </select>

        {selectedRecordA && (
          <>
            {selectedRecordA.assetReference && (
              <div className="relative h-28 w-full rounded-control bg-paper-deep border border-rule overflow-hidden flex items-center justify-center">
                <img
                  src={selectedRecordA.assetReference}
                  alt={selectedRecordA.recordId}
                  style={{
                    filter: getThumbnailFilter(selectedRecordA),
                    transform: selectedRecordA.metadata?.imageFilters?.rotation
                      ? `rotate(${selectedRecordA.metadata.imageFilters.rotation}deg)`
                      : undefined
                  }}
                  className="h-full w-full object-cover"
                />
                <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-paper-deep/80 backdrop-blur-sm text-[10px] text-ink font-mono border border-rule">
                  Pass A
                </div>
                {onEditRecord && (
                  <button
                    type="button"
                    onClick={() => onEditRecord(selectedRecordA)}
                    className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded bg-paper-deep/80 hover:bg-paper-surface backdrop-blur-sm text-[11px] text-ink border border-rule transition-colors flex items-center gap-1 shadow-sm"
                    title="Edit picture calibration & metadata"
                  >
                    <Sliders className="h-3 w-3" />
                    <span>Adjust</span>
                  </button>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono tabular-nums text-muted bg-paper p-2.5 rounded-control border border-rule">
              <div>
                <span className="text-muted-2 block font-sans">Acquisition:</span>
                <span className="text-ink">{selectedRecordA.timestamp.slice(0, 10)}</span>
              </div>
              <div>
                <span className="text-muted-2 block font-sans">Value:</span>
                <span className="text-ink font-medium">
                  {selectedRecordA.value !== undefined ? `${selectedRecordA.value.toFixed(3)} ${selectedRecordA.unit}` : 'Raster asset'}
                </span>
              </div>
              <div className="col-span-2 truncate">
                <span className="text-muted-2 font-sans">Sensor: </span>
                <span className="text-ink">{selectedRecordA.sourceReference || 'Satellite'}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Swap & Step Toolbar (34px Rows with 2px Gaps) */}
      <div className="flex items-center justify-between gap-[2px]">
        <button
          onClick={handleSwapSides}
          className="h-[34px] flex-1 px-3 bg-paper-2 hover:bg-paper-surface border border-rule text-muted hover:text-ink text-xs rounded-control transition-colors flex items-center justify-center space-x-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus"
          title="Swap reference and comparison sides"
        >
          <ArrowLeftRight className="h-4 w-4 shrink-0 text-muted-2" aria-hidden="true" />
          <span>Swap sides</span>
        </button>

        <div className="flex items-center gap-[2px]">
          <button
            onClick={handleStepPrev}
            disabled={indexB <= 0}
            className="h-[34px] w-[34px] flex items-center justify-center bg-paper-2 hover:bg-paper-surface disabled:opacity-40 border border-rule text-muted hover:text-ink rounded-control transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus"
            title="Step to previous observation"
            aria-label="Previous observation"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
          </button>
          <button
            onClick={handleStepNext}
            disabled={indexB >= validRecords.length - 1}
            className="h-[34px] w-[34px] flex items-center justify-center bg-paper-2 hover:bg-paper-surface disabled:opacity-40 border border-rule text-muted hover:text-ink rounded-control transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus"
            title="Step to next observation"
            aria-label="Next observation"
          >
            <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Record B Selector (Comparison) */}
      <div className="p-3 bg-paper-3 rounded-card border border-rule space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-medium text-ink flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-muted" />
            <span>Comparison record (side B)</span>
          </span>
          <span className="text-xs font-mono tabular-nums text-muted-2">
            Index {indexB + 1} of {validRecords.length}
          </span>
        </div>

        <select
          value={selectedRecordB?.recordId || ''}
          onChange={(e) => {
            const found = validRecords.find((r) => r.recordId === e.target.value);
            if (found) onSelectRecordB(found);
          }}
          className="w-full h-[34px] bg-paper border border-rule px-2 text-ink text-xs rounded-control focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus font-mono tabular-nums"
        >
          {validRecords.map((rec) => (
            <option key={rec.recordId} value={rec.recordId}>
              {rec.timestamp.slice(0, 10)} : {rec.recordId}
              {rec.value !== undefined ? ` (${rec.value.toFixed(2)} ${rec.unit})` : ''}
            </option>
          ))}
        </select>

        {selectedRecordB && (
          <>
            {selectedRecordB.assetReference && (
              <div className="relative h-28 w-full rounded-control bg-paper-deep border border-rule overflow-hidden flex items-center justify-center">
                <img
                  src={selectedRecordB.assetReference}
                  alt={selectedRecordB.recordId}
                  style={{
                    filter: getThumbnailFilter(selectedRecordB),
                    transform: selectedRecordB.metadata?.imageFilters?.rotation
                      ? `rotate(${selectedRecordB.metadata.imageFilters.rotation}deg)`
                      : undefined
                  }}
                  className="h-full w-full object-cover"
                />
                <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-paper-deep/80 backdrop-blur-sm text-[10px] text-ink font-mono border border-rule">
                  Pass B
                </div>
                {onEditRecord && (
                  <button
                    type="button"
                    onClick={() => onEditRecord(selectedRecordB)}
                    className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded bg-paper-deep/80 hover:bg-paper-surface backdrop-blur-sm text-[11px] text-ink border border-rule transition-colors flex items-center gap-1 shadow-sm"
                    title="Edit picture calibration & metadata"
                  >
                    <Sliders className="h-3 w-3" />
                    <span>Adjust</span>
                  </button>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono tabular-nums text-muted bg-paper p-2.5 rounded-control border border-rule">
              <div>
                <span className="text-muted-2 block font-sans">Acquisition:</span>
                <span className="text-ink">{selectedRecordB.timestamp.slice(0, 10)}</span>
              </div>
              <div>
                <span className="text-muted-2 block font-sans">Value:</span>
                <span className="text-ink font-medium">
                  {selectedRecordB.value !== undefined ? `${selectedRecordB.value.toFixed(3)} ${selectedRecordB.unit}` : 'Raster asset'}
                </span>
              </div>
              <div className="col-span-2 truncate">
                <span className="text-muted-2 font-sans">Sensor: </span>
                <span className="text-ink">{selectedRecordB.sourceReference || 'Satellite'}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Analytical Delta Summary Card */}
      <div className="p-3 bg-paper-2 border border-rule rounded-card space-y-2.5">
        <span className="font-medium text-ink block text-xs">
          Temporal separation & measured change
        </span>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-paper p-2 rounded-control border border-rule">
            <span className="text-muted-2 text-xs block">Time elapsed</span>
            <span className="text-ink font-mono tabular-nums font-medium">
              {daysDiff !== null ? `${daysDiff} days` : '--'}
            </span>
          </div>

          <div className="bg-paper p-2 rounded-control border border-rule">
            <span className="text-muted-2 text-xs block">Observed delta</span>
            <div className="flex items-center space-x-1 font-mono tabular-nums font-medium">
              {valDelta !== null ? (
                valDelta >= 0 ? (
                  <span className="text-success flex items-center gap-1">
                    <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                    +{valDelta.toFixed(3)}
                  </span>
                ) : (
                  <span className="text-error flex items-center gap-1">
                    <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
                    {valDelta.toFixed(3)}
                  </span>
                )
              ) : (
                <span className="text-muted">--</span>
              )}
            </div>
          </div>
        </div>

        {/* Swipe Handle Position Slider */}
        {compareMode && (
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-xs font-mono tabular-nums text-muted-2">
              <span>Split position</span>
              <span>{Math.round(swipePosition)}%</span>
            </div>
            <input
              type="range"
              min="5"
              max="95"
              value={swipePosition}
              onChange={(e) => setSwipePosition(Number(e.target.value))}
              className="w-full h-1 bg-paper-3 accent-ink cursor-pointer"
            />
          </div>
        )}
      </div>
    </div>
  );
};

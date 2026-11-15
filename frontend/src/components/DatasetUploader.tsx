import React, { useRef, useState } from 'react';
import { Upload, FileText, CheckCircle2, AlertTriangle, Database, X, Image as ImageIcon } from 'lucide-react';
import { UploadedDataset } from '../types/api';
import { DatasetParserService, SAMPLE_DATASETS } from '../services/datasetParser';

interface DatasetUploaderProps {
  onDatasetLoaded: (dataset: UploadedDataset) => void;
  currentDataset: UploadedDataset | null;
  onClearDataset: () => void;
}

export const DatasetUploader: React.FC<DatasetUploaderProps> = ({
  onDatasetLoaded,
  currentDataset,
  onClearDataset
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFilesProcess = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setIsParsing(true);
    setErrorMessage(null);

    const fileList = Array.from(files);
    const imageFiles = fileList.filter((f) => DatasetParserService.isImageFile(f));

    try {
      // Scenario A: Image / Picture files uploaded
      if (imageFiles.length > 0) {
        const parsed = await DatasetParserService.parseImageFiles(imageFiles);
        onDatasetLoaded(parsed);
      } else {
        // Scenario B: Structured data file (CSV, GeoJSON, JSON)
        const file = fileList[0];
        const text = await file.text();
        const parsed = DatasetParserService.parseDataset(file.name, text, file.size);
        if (parsed.validation.status === 'invalid') {
          setErrorMessage(parsed.validation.messages[0] || 'Invalid dataset format.');
        }
        onDatasetLoaded(parsed);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to read dataset / image file.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesProcess(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleSelectSample = (sampleId: string) => {
    const sample = SAMPLE_DATASETS.find((s) => s.id === sampleId);
    if (!sample) return;
    setIsParsing(true);
    setErrorMessage(null);
    try {
      const sizeApprox = new Blob([sample.data]).size;
      const parsed = DatasetParserService.parseDataset(
        `${sample.label}.${sample.format}`,
        sample.data,
        sizeApprox,
        sample.format
      );
      parsed.isDemoSample = true;
      onDatasetLoaded(parsed);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load sample dataset.');
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Upload Header */}
      <div className="flex items-center justify-between">
        <span className="font-medium text-ink">Upload pictures or dataset</span>
        <span className="text-xs text-muted-2 font-mono">Satellite & aerial passes</span>
      </div>

      {/* Drag and Drop Zone - Quiet Graphite Neutral */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`p-6 border-2 border-dashed rounded-card text-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-rule-2 bg-paper-surface'
            : 'border-rule hover:border-rule-2 bg-paper-3'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".png,.jpg,.jpeg,.webp,.tif,.tiff,.bmp,.csv,.geojson,.json"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFilesProcess(e.target.files);
            }
          }}
        />

        <div className="flex items-center justify-center gap-2 mb-2 text-ink-2">
          <ImageIcon className="h-6 w-6" aria-hidden="true" />
          <Upload className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="font-medium text-ink">Drop your picture(s) or dataset files here</div>
        <div className="text-xs text-muted mt-1">or click to browse local files</div>
        <div className="text-xs text-muted-2 mt-2 max-w-xs mx-auto leading-relaxed">
          Accepts single or multiple satellite pictures (PNG, JPG, WebP, TIFF) or structured CSV / GeoJSON.
        </div>
      </div>

      {/* Parsing Status Indicator */}
      {isParsing && (
        <div className="h-[34px] px-3 bg-paper-2 rounded-control border border-rule flex items-center space-x-2 text-muted">
          <div className="h-2 w-2 rounded-full bg-ink-2 shrink-0 animate-pulse" />
          <span className="truncate">Processing imagery and ingesting observation records…</span>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="p-3 bg-paper-2 rounded-control border border-error/30 text-error flex items-start space-x-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-error" aria-hidden="true" />
          <div className="text-xs">{errorMessage}</div>
        </div>
      )}

      {/* Sample Dataset Quick Selector (34px Rows with 2px Gaps) */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center space-x-2 text-muted-2">
          <Database className="h-4 w-4 shrink-0 text-muted-2" aria-hidden="true" />
          <span className="font-medium text-ink">Load sample Earth observation dataset</span>
        </div>
        <div className="space-y-[2px]">
          {SAMPLE_DATASETS.map((sample) => (
            <button
              key={sample.id}
              onClick={() => handleSelectSample(sample.id)}
              className="w-full h-[34px] px-3 rounded-control bg-paper-2 hover:bg-paper-surface border border-rule hover:border-rule-2 transition-colors flex items-center justify-between text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus group"
            >
              <div className="flex items-center gap-2 truncate pr-2">
                <Database className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                <span className="font-medium text-ink truncate group-hover:text-white transition-colors">
                  {sample.label}
                </span>
              </div>
              <span className="text-xs font-mono tabular-nums text-muted-2 shrink-0">
                {sample.recordCount} observations
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

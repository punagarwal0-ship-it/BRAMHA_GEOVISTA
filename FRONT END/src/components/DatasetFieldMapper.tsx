import React, { useState } from 'react';
import { X, Check, Sliders, AlertCircle } from 'lucide-react';
import { UploadedDataset, DatasetFieldMapping } from '../types/api';

interface DatasetFieldMapperProps {
  isOpen: boolean;
  onClose: () => void;
  dataset: UploadedDataset;
  onApplyMapping: (newMapping: DatasetFieldMapping) => void;
}

export const DatasetFieldMapper: React.FC<DatasetFieldMapperProps> = ({
  isOpen,
  onClose,
  dataset,
  onApplyMapping
}) => {
  if (!isOpen) return null;

  // Extract all available column names from first record's metadata or detectedFields
  const availableColumns: string[] = React.useMemo(() => {
    const cols = new Set<string>();
    if (dataset.records[0]?.metadata) {
      Object.keys(dataset.records[0].metadata).forEach((k) => cols.add(k));
    }
    Object.values(dataset.detectedFields).forEach((f) => {
      if (f) cols.add(f);
    });
    return Array.from(cols);
  }, [dataset]);

  const [mapping, setMapping] = useState<DatasetFieldMapping>({ ...dataset.detectedFields });

  const handleSave = () => {
    onApplyMapping(mapping);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mapper-modal-title"
    >
      <div className="bg-paper-2 border border-rule rounded-panel w-full max-w-md overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="h-14 border-b border-rule px-5 flex items-center justify-between bg-paper shrink-0">
          <div className="flex items-center space-x-2.5">
            <Sliders className="h-4 w-4 text-ink-2" aria-hidden="true" />
            <h3 id="mapper-modal-title" className="font-medium text-xs text-ink font-display">
              Dataset field mapper
            </h3>
          </div>
          <button
            onClick={onClose}
            className="h-[34px] w-[34px] flex items-center justify-center rounded-control bg-paper-3 hover:bg-paper-surface text-muted hover:text-ink border border-rule transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus"
            aria-label="Close field mapper"
          >
            <X className="h-4 w-4 shrink-0" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          <p className="text-muted leading-relaxed">
            Verify or reassign which dataset columns correspond to timestamps, observations, and preview assets.
          </p>

          {/* Time / Date Column */}
          <div className="space-y-1.5">
            <label className="text-muted-2 text-xs block">
              Timestamp / date column
            </label>
            <select
              value={mapping.timeField}
              onChange={(e) => setMapping({ ...mapping, timeField: e.target.value })}
              className="w-full bg-paper border border-rule p-2 text-ink text-xs rounded-control focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus font-mono"
            >
              <option value="">(None - sequential order)</option>
              {availableColumns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>

          {/* Observation Value Column */}
          <div className="space-y-1.5">
            <label className="text-muted-2 text-xs block">
              Measurement value column
            </label>
            <select
              value={mapping.valueField}
              onChange={(e) => setMapping({ ...mapping, valueField: e.target.value })}
              className="w-full bg-paper border border-rule p-2 text-ink text-xs rounded-control focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus font-mono"
            >
              <option value="">(None - asset imagery only)</option>
              {availableColumns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>

          {/* Record ID Column */}
          <div className="space-y-1.5">
            <label className="text-muted-2 text-xs block">
              Observation ID column
            </label>
            <select
              value={mapping.idField}
              onChange={(e) => setMapping({ ...mapping, idField: e.target.value })}
              className="w-full bg-paper border border-rule p-2 text-ink text-xs rounded-control focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus font-mono"
            >
              <option value="">(Auto-generate IDs)</option>
              {availableColumns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>

          {/* Variable / Parameter Name Column */}
          <div className="space-y-1.5">
            <label className="text-muted-2 text-xs block">
              Indicator / variable column
            </label>
            <select
              value={mapping.variableField}
              onChange={(e) => setMapping({ ...mapping, variableField: e.target.value })}
              className="w-full bg-paper border border-rule p-2 text-ink text-xs rounded-control focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus font-mono"
            >
              <option value="">(Default from measurement)</option>
              {availableColumns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer (34px Rows with 2px Gaps) */}
        <div className="h-14 border-t border-rule px-5 flex items-center justify-end gap-[2px] bg-paper shrink-0">
          <button
            onClick={onClose}
            className="h-[34px] px-3.5 rounded-control bg-paper-3 hover:bg-paper-surface text-muted hover:text-ink border border-rule text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="h-[34px] px-3.5 rounded-control bg-ink hover:bg-white text-paper font-medium text-xs transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus"
          >
            Apply mapping
          </button>
        </div>
      </div>
    </div>
  );
};

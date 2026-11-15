import React from 'react';
import { X, ShieldCheck, Database, Compass, Layers, Activity, TrendingUp } from 'lucide-react';
import { BramhaIcon } from './BramhaLogo';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="info-modal-title"
    >
      <div className="bg-paper-2 border border-rule rounded-panel w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="h-14 border-b border-rule px-6 flex items-center justify-between bg-paper shrink-0">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 rounded-control bg-paper-3 border border-rule flex items-center justify-center text-ink-2">
              <BramhaIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 id="info-modal-title" className="font-medium text-xs text-ink font-display">
                Bramha intelligence platform
              </h2>
              <span className="text-xs text-muted-2 font-mono">
                System guide and operational safeguards
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-[34px] w-[34px] flex items-center justify-center rounded-control bg-paper-3 hover:bg-paper-surface text-muted hover:text-ink border border-rule transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4 shrink-0" aria-hidden="true" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-ink/90 leading-relaxed">
          {/* Scientific Disclaimer */}
          <div className="p-4 rounded-card bg-paper-3 border border-rule space-y-1.5">
            <div className="flex items-center space-x-2 font-medium text-ink">
              <ShieldCheck className="h-4 w-4 text-ink-2" aria-hidden="true" />
              <span>Scientific guardrails and provenance commitment</span>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              This system strictly differentiates observed satellite measurements (solid cyan lines) from
              statistical model forecasts (dashed amber lines with widening uncertainty bands). Gaps in
              satellite acquisition are preserved rather than fabricated. Synthetic demo fixtures are
              explicitly labeled for UI prototyping.
            </p>
          </div>

          {/* Core Workflow Steps */}
          <div className="space-y-3">
            <h3 className="font-medium text-ink text-xs">
              Standard analytical workflow
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-4 rounded-card bg-paper-3 border border-rule space-y-1.5">
                <div className="font-medium text-ink flex items-center gap-1.5">
                  <Compass className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
                  <span>1. Area of interest</span>
                </div>
                <p className="text-xs text-muted">
                  Search places, drop coordinates with custom buffer radius, draw polygons or boxes, or upload GeoJSON files.
                </p>
              </div>

              <div className="p-4 rounded-card bg-paper-3 border border-rule space-y-1.5">
                <div className="font-medium text-ink flex items-center gap-1.5">
                  <Layers className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
                  <span>2. Sensor and phenomenon</span>
                </div>
                <p className="text-xs text-muted">
                  Choose Vegetation, Water, Urban, Flood, or Glacier dynamics with corresponding Sentinel-2, Landsat-9, or SAR products.
                </p>
              </div>

              <div className="p-4 rounded-card bg-paper-3 border border-rule space-y-1.5">
                <div className="font-medium text-ink flex items-center gap-1.5">
                  <Activity className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
                  <span>3. Temporal scrubber and compare</span>
                </div>
                <p className="text-xs text-muted">
                  Step through discrete satellite passes, animate temporal sequences, or enable split-swipe before and after map comparison.
                </p>
              </div>

              <div className="p-4 rounded-card bg-paper-3 border border-rule space-y-1.5">
                <div className="font-medium text-ink flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
                  <span>4. Predictive horizon</span>
                </div>
                <p className="text-xs text-muted">
                  Evaluate forecast curves with statistical uncertainty envelopes (80% & 95% confidence intervals) backed by validation metrics.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="h-14 border-t border-rule px-6 flex items-center justify-end bg-paper shrink-0">
          <button
            onClick={onClose}
            className="h-[34px] px-4 rounded-control bg-paper-surface hover:bg-paper-surface-hover text-ink border border-rule text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus"
          >
            Acknowledge and close
          </button>
        </div>
      </div>
    </div>
  );
};

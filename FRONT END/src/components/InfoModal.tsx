import React from 'react';
import { X, Satellite, ShieldCheck, Database, Compass, Layers, Activity, TrendingUp } from 'lucide-react';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none">
      <div className="bg-slate-900 border border-geo-border rounded-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="h-14 border-b border-geo-border px-5 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center space-x-2.5">
            <div className="h-8 w-8 rounded-lg bg-teal-600 flex items-center justify-center">
              <Satellite className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-slate-100">
                GEOVISTA Intelligence Platform
              </h2>
              <span className="text-[10px] text-teal-400 font-mono">
                System Guide & Operational Safeguards
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-300 leading-relaxed">
          {/* Scientific Disclaimer */}
          <div className="p-3.5 rounded-lg bg-amber-950/40 border border-amber-500/50 space-y-1 text-amber-200">
            <div className="flex items-center space-x-2 font-semibold text-amber-300">
              <ShieldCheck className="h-4 w-4 text-amber-400" />
              <span>Scientific Guardrails & Provenance Commitment</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              This system strictly differentiates observed satellite measurements (solid lines) from
              statistical model forecasts (dashed lines with widening uncertainty bands). Gaps in
              satellite acquisition are preserved rather than fabricated. Synthetic demo fixtures are
              explicitly labeled for UI prototyping.
            </p>
          </div>

          {/* Core Workflow Steps */}
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-100 text-xs uppercase tracking-wider">
              Standard Analytical Workflow
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-slate-800/40 border border-geo-border space-y-1">
                <div className="font-semibold text-teal-300 flex items-center gap-1.5">
                  <Compass className="h-3.5 w-3.5" />
                  1. Area of Interest (AOI)
                </div>
                <p className="text-[11px] text-slate-400">
                  Search places, drop coordinates with custom buffer radius, draw polygons/boxes, or upload GeoJSON files.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-800/40 border border-geo-border space-y-1">
                <div className="font-semibold text-teal-300 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" />
                  2. Sensor & Phenomenon
                </div>
                <p className="text-[11px] text-slate-400">
                  Choose Vegetation, Water, Urban, Flood, or Glacier dynamics with corresponding Sentinel-2, Landsat-9, or SAR products.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-800/40 border border-geo-border space-y-1">
                <div className="font-semibold text-teal-300 flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5" />
                  3. Temporal Scrubber & Compare
                </div>
                <p className="text-[11px] text-slate-400">
                  Step through discrete satellite passes, animate temporal sequences, or enable split-swipe before/after map comparison.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-800/40 border border-geo-border space-y-1">
                <div className="font-semibold text-amber-400 flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" />
                  4. Predictive Horizon
                </div>
                <p className="text-[11px] text-slate-400">
                  Review model forecasts, 80% & 95% confidence intervals, holdout validation scores (RMSE, R²), and quality limitations.
                </p>
              </div>
            </div>
          </div>

          {/* API Contracts */}
          <div className="space-y-2">
            <h3 className="font-semibold text-slate-100 text-xs uppercase tracking-wider">
              Backend Integration Contracts
            </h3>
            <div className="bg-slate-950 p-3 rounded-lg font-mono text-[10px] space-y-1 text-slate-400 border border-slate-800">
              <div><span className="text-teal-400">POST</span> /api/analysis/jobs — Submit AOI, phenomenon & requested outputs</div>
              <div><span className="text-teal-400">GET</span> /api/analysis/jobs/:id — Poll async execution status</div>
              <div><span className="text-teal-400">GET</span> /api/analysis/jobs/:id/observations — Historical time series</div>
              <div><span className="text-teal-400">GET</span> /api/analysis/jobs/:id/changes — Detected disturbance events</div>
              <div><span className="text-teal-400">GET</span> /api/analysis/jobs/:id/forecast — Horizon forecast with uncertainty</div>
              <div><span className="text-teal-400">GET</span> /api/catalog/search — Intersecting STAC satellite granules</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="h-12 border-t border-geo-border px-5 flex items-center justify-end bg-slate-950/60">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-lg text-xs transition-colors"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};


import React, { useState } from 'react';
import {
  Activity,
  TrendingUp,
  Clock,
  Layers,
  ChevronRight,
  ChevronLeft,
  Info,
  Maximize2,
  FileText,
  MapPin,
  Calendar,
  Cloud
} from 'lucide-react';
import {
  AOI,
  ObservationScene,
  TimeSeriesPoint,
  ChangeEvent,
  ForecastPoint,
  ForecastModelMetadata,
  AnalysisJob,
  PhenomenonType
} from '../types/api';
import { TimeSeriesChart } from './TimeSeriesChart';
import { ForecastPanel } from './ForecastPanel';
import { JobStatus } from './JobStatus';

interface AnalysisPanelProps {
  activeAoi: AOI | null;
  selectedScene: ObservationScene | null;
  phenomenon: PhenomenonType;
  indicator: string;
  observations: TimeSeriesPoint[];
  changes: ChangeEvent[];
  forecast: ForecastPoint[];
  forecastMetadata: ForecastModelMetadata | null;
  jobs: AnalysisJob[];
  activeJobId: string | null;
  onSelectJob: (jobId: string) => void;
  onSubmitNewJob: (edgeCase: 'normal' | 'insufficient_history' | 'cloud_failure' | 'partial_data') => void;
  isSubmittingJob: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
  activeAoi,
  selectedScene,
  phenomenon,
  indicator,
  observations,
  changes,
  forecast,
  forecastMetadata,
  jobs,
  activeJobId,
  onSelectJob,
  onSubmitNewJob,
  isSubmittingJob,
  isCollapsed,
  onToggleCollapse
}) => {
  const [activeTab, setActiveTab] = useState<'indicators' | 'forecast' | 'overview' | 'jobs'>(
    'indicators'
  );

  if (isCollapsed) {
    return (
      <div className="absolute right-0 top-14 bottom-0 w-10 bg-slate-900/95 border-l border-geo-border flex flex-col items-center py-3 space-y-4 z-20 backdrop-blur-md">
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-400 transition-colors"
          title="Expand Analysis Dashboard"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="writing-vertical text-slate-400 text-xs font-semibold tracking-wider uppercase rotate-180">
          Analysis Dashboard
        </div>
      </div>
    );
  }

  return (
    <aside className="w-96 md:w-[420px] bg-slate-900/95 border-l border-geo-border flex flex-col z-20 backdrop-blur-md overflow-hidden select-none shadow-2xl">
      {/* Panel Header */}
      <div className="h-12 border-b border-geo-border px-3.5 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <Activity className="h-4 w-4 text-teal-400" />
          <span className="font-semibold text-slate-100 text-xs tracking-wider uppercase">
            Geospatial Analytics
          </span>
        </div>

        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          title="Collapse Panel"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs Header */}
      <div className="flex border-b border-geo-border bg-slate-950/60 p-1 shrink-0 text-xs">
        <button
          onClick={() => setActiveTab('indicators')}
          className={`flex-1 py-1.5 rounded-md font-medium text-center transition-all ${
            activeTab === 'indicators'
              ? 'bg-geo-accent text-slate-900 font-semibold shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Historical
        </button>

        <button
          onClick={() => setActiveTab('forecast')}
          className={`flex-1 py-1.5 rounded-md font-medium text-center transition-all ${
            activeTab === 'forecast'
              ? 'bg-amber-500 text-slate-900 font-semibold shadow'
              : 'text-amber-400/80 hover:text-amber-300'
          }`}
        >
          Forecast
        </button>

        <button
          onClick={() => setActiveTab('overview')}
          className={`flex-1 py-1.5 rounded-md font-medium text-center transition-all ${
            activeTab === 'overview'
              ? 'bg-geo-accent text-slate-900 font-semibold shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Scene
        </button>

        <button
          onClick={() => setActiveTab('jobs')}
          className={`flex-1 py-1.5 rounded-md font-medium text-center transition-all relative ${
            activeTab === 'jobs'
              ? 'bg-geo-accent text-slate-900 font-semibold shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Jobs
          {jobs.some((j) => j.status === 'running') && (
            <span className="absolute top-1 right-2 h-2 w-2 rounded-full bg-teal-400 animate-ping" />
          )}
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {activeTab === 'indicators' && (
          <TimeSeriesChart
            observations={observations}
            changes={changes}
            indicator={indicator}
            phenomenon={phenomenon}
          />
        )}

        {activeTab === 'forecast' && (
          <ForecastPanel
            forecast={forecast}
            metadata={forecastMetadata}
            historicalObservations={observations}
            indicator={indicator}
          />
        )}

        {activeTab === 'overview' && (
          <div className="space-y-3.5 text-xs">
            {/* Selected Scene Metadata Card */}
            {selectedScene ? (
              <div className="p-3 rounded-lg bg-slate-900/90 border border-teal-500/40 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <span className="font-semibold text-teal-300">Selected Satellite Granule</span>
                  <span className="text-[10px] font-mono text-slate-400">{selectedScene.collection}</span>
                </div>

                <div className="text-[11px] font-mono text-slate-200 break-all bg-slate-950 p-2 rounded">
                  {selectedScene.productId}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                  <div className="bg-slate-800/60 p-2 rounded">
                    <span className="text-slate-400 block text-[9px]">Acquisition Date</span>
                    <span className="text-slate-100 font-semibold">
                      {selectedScene.acquiredAt.slice(0, 10)}
                    </span>
                  </div>
                  <div className="bg-slate-800/60 p-2 rounded">
                    <span className="text-slate-400 block text-[9px]">Time (UTC)</span>
                    <span className="text-slate-100 font-semibold">
                      {selectedScene.acquiredAt.slice(11, 19)}
                    </span>
                  </div>
                  <div className="bg-slate-800/60 p-2 rounded">
                    <span className="text-slate-400 block text-[9px]">Cloud Cover</span>
                    <span className="text-cyan-400 font-semibold">{selectedScene.cloudCoverPct}%</span>
                  </div>
                  <div className="bg-slate-800/60 p-2 rounded">
                    <span className="text-slate-400 block text-[9px]">Spatial Resolution</span>
                    <span className="text-slate-100 font-semibold">{selectedScene.resolutionMeters}m GSD</span>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 pt-1">
                  Provider: <span className="text-slate-200 font-semibold">{selectedScene.provider}</span>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-slate-400 bg-slate-900/40 rounded-lg border border-dashed border-slate-800">
                <Layers className="h-6 w-6 text-slate-600 mx-auto mb-2" />
                <div className="text-xs font-semibold text-slate-300">No Scene Selected</div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Click any satellite footprint on the map or select an acquisition from the catalog tab.
                </p>
              </div>
            )}

            {/* Active AOI Summary */}
            {activeAoi && (
              <div className="p-3 rounded-lg bg-slate-900/60 border border-geo-border space-y-2">
                <span className="font-semibold text-slate-200 block text-xs">
                  Target Area of Interest
                </span>
                <div className="text-slate-300 font-medium text-xs">{activeAoi.name}</div>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400">
                  <div>Area: {activeAoi.areaSqKm.toLocaleString()} km²</div>
                  <div>Centroid: {activeAoi.center[1]}°N, {activeAoi.center[0]}°E</div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'jobs' && (
          <JobStatus
            jobs={jobs}
            activeJobId={activeJobId}
            onSelectJob={onSelectJob}
            onSubmitNewJob={onSubmitNewJob}
            isSubmitting={isSubmittingJob}
            activeAoi={activeAoi}
            phenomenon={phenomenon}
            indicator={indicator}
          />
        )}
      </div>
    </aside>
  );
};


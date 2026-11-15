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
      <div className="absolute right-0 top-[88px] bottom-0 w-10 bg-paper-2 border-l border-rule flex flex-col items-center py-4 space-y-4 z-20">
        <button
          onClick={onToggleCollapse}
          className="h-[34px] w-[34px] flex items-center justify-center rounded-control bg-paper-3 hover:bg-paper-surface text-muted hover:text-ink border border-rule transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus"
          title="Expand analysis dashboard"
          aria-label="Expand analysis dashboard"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
        </button>

        <div className="writing-vertical text-muted text-xs font-medium rotate-180">
          Analysis dashboard
        </div>
      </div>
    );
  }

  return (
    <aside className="w-96 md:w-[416px] bg-paper-2 border-l border-rule flex flex-col z-20 overflow-hidden select-none">
      {/* Panel Header */}
      <div className="h-14 border-b border-rule px-4 flex items-center justify-between shrink-0 bg-paper">
        <div className="flex items-center space-x-2">
          <Activity className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
          <span className="font-medium text-ink text-xs">
            Geospatial analytics
          </span>
        </div>

        <button
          onClick={onToggleCollapse}
          className="h-[34px] w-[34px] flex items-center justify-center rounded-control bg-paper-3 hover:bg-paper-surface text-muted hover:text-ink border border-rule transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus"
          title="Collapse analysis panel"
          aria-label="Collapse analysis panel"
        >
          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
        </button>
      </div>

      {/* Tabs Header - Quiet 34px Navigation Rows with 2px Gaps */}
      <div className="flex border-b border-rule bg-paper p-[2px] shrink-0 text-xs gap-[2px]">
        <button
          onClick={() => setActiveTab('indicators')}
          className={`h-[34px] flex-1 flex items-center justify-center gap-1.5 px-3 rounded-control font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus ${
            activeTab === 'indicators'
              ? 'bg-paper-surface text-ink border border-rule shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
              : 'text-muted hover:text-ink hover:bg-paper-surface/50 border border-transparent'
          }`}
        >
          <Activity className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <span>Historical</span>
        </button>

        <button
          onClick={() => setActiveTab('forecast')}
          className={`h-[34px] flex-1 flex items-center justify-center gap-1.5 px-3 rounded-control font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus ${
            activeTab === 'forecast'
              ? 'bg-paper-surface text-ink border border-rule shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
              : 'text-muted hover:text-ink hover:bg-paper-surface/50 border border-transparent'
          }`}
        >
          <TrendingUp className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <span>Forecast</span>
        </button>

        <button
          onClick={() => setActiveTab('overview')}
          className={`h-[34px] flex-1 flex items-center justify-center gap-1.5 px-3 rounded-control font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus ${
            activeTab === 'overview'
              ? 'bg-paper-surface text-ink border border-rule shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
              : 'text-muted hover:text-ink hover:bg-paper-surface/50 border border-transparent'
          }`}
        >
          <Layers className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <span>Scene</span>
        </button>

        <button
          onClick={() => setActiveTab('jobs')}
          className={`h-[34px] flex-1 flex items-center justify-center gap-1.5 px-3 rounded-control font-medium transition-colors relative focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus ${
            activeTab === 'jobs'
              ? 'bg-paper-surface text-ink border border-rule shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
              : 'text-muted hover:text-ink hover:bg-paper-surface/50 border border-transparent'
          }`}
        >
          <Clock className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <span>Jobs</span>
          {jobs.some((j) => j.status === 'running') && (
            <span
              className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-ink-2"
              aria-hidden="true"
            />
          )}
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
          <div className="space-y-4 text-xs">
            {/* Selected Scene Metadata Card */}
            {selectedScene ? (
              <div className="p-3 rounded-card bg-paper-3 border border-rule space-y-2.5">
                <div className="flex items-center justify-between border-b border-rule pb-1.5">
                  <span className="font-medium text-ink">Selected satellite granule</span>
                  <span className="text-xs font-mono text-muted">{selectedScene.collection}</span>
                </div>

                <div className="text-xs font-mono text-ink break-all bg-paper p-2 rounded-control border border-rule">
                  {selectedScene.productId}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono tabular-nums">
                  <div className="bg-paper-2 p-2 rounded-control border border-rule">
                    <span className="text-muted-2 block text-xs font-sans">Acquisition date</span>
                    <span className="text-ink font-medium">
                      {selectedScene.acquiredAt.slice(0, 10)}
                    </span>
                  </div>
                  <div className="bg-paper-2 p-2 rounded-control border border-rule">
                    <span className="text-muted-2 block text-xs font-sans">Time (UTC)</span>
                    <span className="text-ink font-medium">
                      {selectedScene.acquiredAt.slice(11, 19)}
                    </span>
                  </div>
                  <div className="bg-paper-2 p-2 rounded-control border border-rule">
                    <span className="text-muted-2 block text-xs font-sans">Cloud cover</span>
                    <span className="text-ink font-medium">{selectedScene.cloudCoverPct}%</span>
                  </div>
                  <div className="bg-paper-2 p-2 rounded-control border border-rule">
                    <span className="text-muted-2 block text-xs font-sans">Spatial resolution</span>
                    <span className="text-ink font-medium">{selectedScene.resolutionMeters}m GSD</span>
                  </div>
                </div>

                <div className="text-xs text-muted pt-1">
                  Provider: <span className="text-ink font-medium">{selectedScene.provider}</span>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-muted bg-paper-3 rounded-card border border-dashed border-rule">
                <Layers className="h-6 w-6 text-muted-2 mx-auto mb-2" aria-hidden="true" />
                <div className="text-xs font-medium text-ink">No scene selected</div>
                <p className="text-xs text-muted-2 mt-1">
                  Click any satellite footprint on the map or select an acquisition from the catalog tab.
                </p>
              </div>
            )}

            {/* Active AOI Summary */}
            {activeAoi && (
              <div className="p-3 rounded-card bg-paper-3 border border-rule space-y-2">
                <span className="font-medium text-ink block text-xs">
                  Target area of interest
                </span>
                <div className="text-ink font-medium text-xs">{activeAoi.name}</div>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono tabular-nums text-muted">
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

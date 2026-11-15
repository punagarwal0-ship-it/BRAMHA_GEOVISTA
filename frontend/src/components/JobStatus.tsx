import React, { useState } from 'react';
import {
  Activity,
  Play,
  RotateCcw,
  AlertTriangle
} from 'lucide-react';
import { AnalysisJob, AOI, PhenomenonType } from '../types/api';

interface JobStatusProps {
  jobs: AnalysisJob[];
  activeJobId: string | null;
  onSelectJob: (jobId: string) => void;
  onSubmitNewJob: (edgeCase: 'normal' | 'insufficient_history' | 'cloud_failure' | 'partial_data') => void;
  isSubmitting: boolean;
  activeAoi: AOI | null;
  phenomenon: PhenomenonType;
  indicator: string;
}

export const JobStatus: React.FC<JobStatusProps> = ({
  jobs,
  activeJobId,
  onSelectJob,
  onSubmitNewJob,
  isSubmitting,
  activeAoi,
  phenomenon,
  indicator
}) => {
  const [selectedEdgeCase, setSelectedEdgeCase] = useState<
    'normal' | 'insufficient_history' | 'cloud_failure' | 'partial_data'
  >('normal');

  return (
    <div className="space-y-4 text-xs select-none">
      {/* Submit Analysis Job Card */}
      <div className="p-3 bg-paper-2 rounded-card border border-rule space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="font-medium text-ink flex items-center gap-1.5 text-xs">
            <Activity className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
            <span>Dispatch analysis job</span>
          </span>
          <span className="text-xs font-mono text-muted bg-paper-3 px-2 py-0.5 rounded-sm border border-rule">
            Execution queue
          </span>
        </div>

        <p className="text-xs text-muted-2 leading-relaxed">
          Submit the active geometry and requested indicator to the async execution queue.
        </p>

        {/* Edge Case Simulation Selector (34px Control) */}
        <div>
          <label className="text-xs text-muted-2 block mb-1">
            Pipeline test condition
          </label>
          <select
            value={selectedEdgeCase}
            onChange={(e: any) => setSelectedEdgeCase(e.target.value)}
            className="w-full h-[34px] bg-paper-3 rounded-control border border-rule text-ink text-xs px-2.5 outline-none font-mono"
          >
            <option value="normal">Standard pipeline (full history and forecast)</option>
            <option value="insufficient_history">Edge case: insufficient depth (&lt;12 observations)</option>
            <option value="cloud_failure">Edge case: cloud contamination failure (&gt;85%)</option>
            <option value="partial_data">Edge case: partial analytical results</option>
          </select>
        </div>

        {/* Action Button (34px Row) */}
        <button
          onClick={() => onSubmitNewJob(selectedEdgeCase)}
          disabled={!activeAoi || isSubmitting}
          className="w-full h-[34px] rounded-control bg-ink hover:bg-white disabled:bg-paper-3 disabled:text-muted-2 text-paper font-medium text-xs whitespace-nowrap flex items-center justify-center space-x-2 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus"
        >
          {isSubmitting ? (
            <>
              <Activity className="h-4 w-4 shrink-0 motion-safe:animate-spin" aria-hidden="true" />
              <span>Queueing job…</span>
            </>
          ) : (
            <>
              <Play className="h-4 w-4 shrink-0 fill-current" aria-hidden="true" />
              <span className="truncate">
                {activeAoi ? `Run analysis: ${activeAoi.name}` : 'Select an area first'}
              </span>
            </>
          )}
        </button>
      </div>

      {/* Jobs Queue List (34px Rows with 2px Gaps) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted">
            Job queue ({jobs.length})
          </label>
          <span className="text-xs text-muted-2 font-mono">Async queue</span>
        </div>

        {jobs.length === 0 ? (
          <div className="p-6 text-center text-muted-2 bg-paper-3 rounded-card border border-dashed border-rule">
            No analysis jobs submitted yet.
          </div>
        ) : (
          <div className="space-y-[2px] max-h-[380px] overflow-y-auto pr-1">
            {jobs.map((job) => {
              const isSelected = activeJobId === job.id;
              const isRunning = job.status === 'running' || job.status === 'queued';
              const isFailed = job.status === 'failed';

              return (
                <div
                  key={job.id}
                  onClick={() => onSelectJob(job.id)}
                  className={`h-[34px] px-3 rounded-control border cursor-pointer transition-colors flex items-center justify-between text-xs ${
                    isSelected
                      ? 'bg-paper-surface border-rule-2 text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                      : 'bg-paper-3 border-rule hover:bg-paper-2'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <Activity className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                    <span className="font-medium text-ink truncate">
                      {job.aoiName}
                    </span>
                    <span className="font-mono text-xs text-muted-2 truncate">
                      ({job.indicator})
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0 font-mono tabular-nums text-xs">
                    <span
                      className={`px-1.5 py-0.5 rounded-sm border text-xs ${
                        isRunning
                          ? 'border-rule text-ink-2 bg-paper-2'
                          : isFailed
                          ? 'border-error/40 text-error'
                          : 'border-success/40 text-success'
                      }`}
                    >
                      {job.status}
                    </span>
                    <span className="text-muted-2 text-xs">
                      {job.submittedAt.slice(11, 16)} UTC
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

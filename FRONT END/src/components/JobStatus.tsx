import React, { useState } from 'react';
import {
  Activity,
  Play,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  Clock,
  ExternalLink,
  Trash2,
  Bookmark,
  Layers,
  ChevronRight,
  Sparkles,
  ShieldAlert
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
      <div className="p-3 rounded-lg bg-slate-900/90 border border-teal-500/50 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-100 flex items-center gap-1.5 text-xs">
            <Sparkles className="h-3.5 w-3.5 text-teal-400" />
            Dispatch Geospatial Analysis Job
          </span>
          <span className="text-[10px] font-mono text-teal-400 bg-teal-950 px-1.5 py-0.5 rounded">
            POST /api/analysis/jobs
          </span>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          Submit the active AOI geometry, phenomenon, and requested indicators to the asynchronous analytical execution queue.
        </p>

        {/* Edge Case Simulation Selector (for thorough verification) */}
        <div>
          <label className="text-[10px] text-slate-400 font-semibold block mb-1">
            Pipeline Simulation Mode / Edge Cases:
          </label>
          <select
            value={selectedEdgeCase}
            onChange={(e: any) => setSelectedEdgeCase(e.target.value)}
            className="w-full bg-slate-950 border border-geo-border text-slate-200 text-xs rounded p-1.5 outline-none font-mono"
          >
            <option value="normal">Standard Pipeline (Full History + Forecast)</option>
            <option value="insufficient_history">Edge Case: Insufficient Historical Depth (&lt;12 obs)</option>
            <option value="cloud_failure">Edge Case: Cloud Contamination Failure (&gt;85% cloud)</option>
            <option value="partial_data">Edge Case: Partial Analytical Results</option>
          </select>
        </div>

        <button
          onClick={() => onSubmitNewJob(selectedEdgeCase)}
          disabled={!activeAoi || isSubmitting}
          className="w-full py-2 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white font-semibold rounded-lg shadow-lg shadow-teal-500/20 flex items-center justify-center space-x-2 transition-all text-xs"
        >
          {isSubmitting ? (
            <>
              <Activity className="h-3.5 w-3.5 animate-spin" />
              <span>Queueing Pipeline Job...</span>
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Submit Analysis for {activeAoi ? activeAoi.name : 'Select AOI First'}</span>
            </>
          )}
        </button>
      </div>

      {/* Jobs Queue List */}
      <div className="space-y-2">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block flex items-center justify-between">
          <span>Active & Historical Jobs ({jobs.length})</span>
          <span className="text-[10px] text-teal-400 font-mono">Async Queue</span>
        </label>

        {jobs.length === 0 ? (
          <div className="p-6 text-center text-slate-500 bg-slate-900/40 rounded-lg border border-dashed border-slate-800">
            No analysis jobs submitted yet.
          </div>
        ) : (
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {jobs.map((job) => {
              const isSelected = activeJobId === job.id;
              const isRunning = job.status === 'running' || job.status === 'queued';
              const isFailed = job.status === 'failed';
              const isCompleted = job.status === 'completed';

              return (
                <div
                  key={job.id}
                  onClick={() => onSelectJob(job.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-slate-800/90 border-teal-400 shadow-md shadow-teal-500/10'
                      : 'bg-slate-900/60 border-geo-border hover:bg-slate-800/60'
                  }`}
                >
                  {/* Job Header */}
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-200 text-xs truncate max-w-[170px]">
                      {job.aoiName}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-semibold ${
                        isRunning
                          ? 'bg-teal-950 text-teal-300 border border-teal-800 animate-pulse'
                          : isFailed
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      }`}
                    >
                      {job.status}
                    </span>
                  </div>

                  {/* Phenomenon & Indicator Pill */}
                  <div className="text-[10px] font-mono text-slate-400 mb-2">
                    {job.phenomenon.toUpperCase()} • {job.indicator.toUpperCase()} • {job.aggregation}
                  </div>

                  {/* Progress Bar */}
                  {isRunning && (
                    <div className="space-y-1 my-2">
                      <div className="flex justify-between text-[10px] font-mono text-slate-400">
                        <span className="truncate max-w-[180px]">{job.currentStage}</span>
                        <span className="text-teal-400 font-bold">{job.progressPct}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-teal-500 to-cyan-400 transition-all duration-300"
                          style={{ width: `${job.progressPct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Error Message & Retry */}
                  {isFailed && (
                    <div className="mt-2 p-2 rounded bg-rose-950/40 border border-rose-800/50 text-[10px] text-rose-300 space-y-1">
                      <div className="flex items-start gap-1">
                        <AlertTriangle className="h-3 w-3 shrink-0 text-rose-400 mt-0.5" />
                        <span>{job.error}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSubmitNewJob('normal');
                        }}
                        className="mt-1 px-2 py-0.5 bg-rose-800 hover:bg-rose-700 text-white font-semibold rounded text-[10px] flex items-center space-x-1"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>Retry Analysis</span>
                      </button>
                    </div>
                  )}

                  {/* Footer Timestamps */}
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mt-2 pt-1.5 border-t border-slate-800/60">
                    <span>Job ID: {job.id.slice(0, 12)}</span>
                    <span>{job.submittedAt.slice(11, 19)} UTC</span>
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


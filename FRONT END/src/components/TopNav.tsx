import React from 'react';
import {
  Satellite,
  Layers,
  Activity,
  TrendingUp,
  Bell,
  Info,
  Server,
  Compass,
  CheckCircle2,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { AOI, AnalysisJob } from '../types/api';

interface TopNavProps {
  activeAoi: AOI | null;
  activeTab: 'workspace' | 'catalog' | 'analytics' | 'prediction';
  setActiveTab: (tab: 'workspace' | 'catalog' | 'analytics' | 'prediction') => void;
  jobs: AnalysisJob[];
  onOpenJobsModal: () => void;
  onOpenInfoModal: () => void;
  isMockMode: boolean;
}

export const TopNav: React.FC<TopNavProps> = ({
  activeAoi,
  activeTab,
  setActiveTab,
  jobs,
  onOpenJobsModal,
  onOpenInfoModal,
  isMockMode
}) => {
  const runningJobsCount = jobs.filter((j) => j.status === 'running' || j.status === 'queued').length;
  const completedJobsCount = jobs.filter((j) => j.status === 'completed').length;

  return (
    <header className="h-14 bg-geo-surface border-b border-geo-border flex items-center justify-between px-4 z-30 select-none">
      {/* Brand & Identity */}
      <div className="flex items-center space-x-3">
        <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-teal-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-teal-500/20">
          <Satellite className="h-5 w-5 text-white animate-pulse" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="font-bold text-base tracking-wider text-slate-100 flex items-center gap-1.5">
              GEOVISTA <span className="text-teal-400 font-light">INTELLIGENCE</span>
            </h1>
            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-300 border border-teal-500/30">
              v2.4
            </span>
          </div>
          <p className="text-[10px] text-slate-400 hidden sm:block">
            Earth-Observation, Biogeochemical Trends & Predictive Modeling
          </p>
        </div>
      </div>

      {/* Center Navigation Tabs */}
      <nav className="hidden md:flex items-center space-x-1 bg-geo-bg/70 p-1 rounded-lg border border-geo-border">
        <button
          onClick={() => setActiveTab('workspace')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            activeTab === 'workspace'
              ? 'bg-geo-accent text-slate-900 font-semibold shadow'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Compass className="h-3.5 w-3.5" />
          <span>Map Workspace</span>
        </button>

        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            activeTab === 'catalog'
              ? 'bg-geo-accent text-slate-900 font-semibold shadow'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>Data Catalog</span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            activeTab === 'analytics'
              ? 'bg-geo-accent text-slate-900 font-semibold shadow'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Activity className="h-3.5 w-3.5" />
          <span>Historical Analytics</span>
        </button>

        <button
          onClick={() => setActiveTab('prediction')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            activeTab === 'prediction'
              ? 'bg-amber-500 text-slate-900 font-semibold shadow'
              : 'text-amber-300/80 hover:text-amber-200 hover:bg-amber-950/30'
          }`}
        >
          <TrendingUp className="h-3.5 w-3.5" />
          <span>Predictive Horizon</span>
        </button>
      </nav>

      {/* Right Controls & Status */}
      <div className="flex items-center space-x-3">
        {/* Active AOI pill */}
        {activeAoi ? (
          <div className="hidden lg:flex items-center space-x-2 bg-slate-800/80 px-2.5 py-1 rounded-full border border-teal-500/40 text-xs">
            <span className="h-2 w-2 rounded-full bg-teal-400 animate-ping" />
            <span className="text-slate-200 font-medium truncate max-w-[150px]">{activeAoi.name}</span>
            <span className="text-teal-400 font-mono text-[11px] font-semibold">
              {activeAoi.areaSqKm.toLocaleString()} km²
            </span>
          </div>
        ) : (
          <div className="hidden lg:flex items-center space-x-1.5 text-xs text-slate-400 bg-slate-800/40 px-2.5 py-1 rounded-full border border-slate-700/60">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            <span>No AOI Selected</span>
          </div>
        )}

        {/* DEMO / SYNTHETIC Badge (Strict brief requirement 12 & 13) */}
        {isMockMode && (
          <div
            title="UI running with typed synthetic satellite fixtures for offline/prototyping mode."
            className="flex items-center space-x-1 bg-purple-950/70 border border-purple-500/40 text-purple-300 text-[10px] font-mono px-2 py-0.5 rounded uppercase tracking-wider font-semibold cursor-help"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
            <span>DEMO / SYNTHETIC</span>
          </div>
        )}

        {/* Jobs Queue Bell */}
        <button
          onClick={onOpenJobsModal}
          className="relative p-2 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-slate-300 hover:text-white border border-geo-border transition-colors"
          title="Analysis Jobs & Queue"
        >
          <Bell className="h-4 w-4" />
          {runningJobsCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 bg-teal-500 text-slate-950 font-mono font-bold text-[10px] rounded-full flex items-center justify-center animate-bounce">
              {runningJobsCount}
            </span>
          )}
          {runningJobsCount === 0 && completedJobsCount > 0 && (
            <span className="absolute top-1 right-1 h-2 w-2 bg-emerald-400 rounded-full" />
          )}
        </button>

        {/* Project Guide / Info Button */}
        <button
          onClick={onOpenInfoModal}
          className="p-2 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-slate-300 hover:text-white border border-geo-border transition-colors"
          title="Platform Architecture & Guidance"
        >
          <Info className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
};


import React from 'react';
import {
  Satellite,
  Layers,
  Activity,
  TrendingUp,
  Bell,
  Info,
  Compass,
  AlertTriangle,
  Database
} from 'lucide-react';
import { AOI, AnalysisJob, UploadedDataset } from '../types/api';
import { BramhaLogo } from './BramhaLogo';

interface TopNavProps {
  activeAoi: AOI | null;
  activeDataset?: UploadedDataset | null;
  activeTab: 'overview' | 'workspace' | 'catalog' | 'analytics' | 'prediction';
  setActiveTab: (tab: 'overview' | 'workspace' | 'catalog' | 'analytics' | 'prediction') => void;
  jobs: AnalysisJob[];
  onOpenJobsModal: () => void;
  onOpenInfoModal: () => void;
  isMockMode: boolean;
}

export const TopNav: React.FC<TopNavProps> = ({
  activeAoi,
  activeDataset,
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
    <header className="mx-3 mt-2.5 mb-1.5 h-[74px] bg-paper-2 border border-rule rounded-2xl flex items-center justify-between px-6 z-30 select-none shrink-0 relative shadow-[0_4px_24px_rgba(0,0,0,0.35)]">
      {/* Brand & Identity: Bramha Lockup */}
      <BramhaLogo />

      {/* Centered Main Navigation Panel with Smooth Rounded Pill Corners & Dim White Ambient Lighting */}
      <nav className="hidden md:flex items-center gap-1 bg-paper-3/95 p-1 rounded-full border border-rule shadow-[0_0_25px_rgba(255,255,255,0.06)] absolute left-1/2 -translate-x-1/2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`h-[36px] flex items-center gap-2 px-4 text-xs font-medium rounded-full transition-colors ${
            activeTab === 'overview'
              ? 'bg-paper-surface text-ink border border-rule shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
              : 'text-muted hover:text-ink hover:bg-paper-surface/50 border border-transparent'
          }`}
        >
          <Satellite className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <span>Product overview</span>
        </button>

        <button
          onClick={() => setActiveTab('workspace')}
          className={`h-[36px] flex items-center gap-2 px-4 text-xs font-medium rounded-full transition-colors ${
            activeTab === 'workspace'
              ? 'bg-paper-surface text-ink border border-rule shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
              : 'text-muted hover:text-ink hover:bg-paper-surface/50 border border-transparent'
          }`}
        >
          <Compass className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <span>Map workspace</span>
        </button>

        <button
          onClick={() => setActiveTab('catalog')}
          className={`h-[36px] flex items-center gap-2 px-4 text-xs font-medium rounded-full transition-colors ${
            activeTab === 'catalog'
              ? 'bg-paper-surface text-ink border border-rule shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
              : 'text-muted hover:text-ink hover:bg-paper-surface/50 border border-transparent'
          }`}
        >
          <Layers className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <span>Data catalog</span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`h-[36px] flex items-center gap-2 px-4 text-xs font-medium rounded-full transition-colors ${
            activeTab === 'analytics'
              ? 'bg-paper-surface text-ink border border-rule shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
              : 'text-muted hover:text-ink hover:bg-paper-surface/50 border border-transparent'
          }`}
        >
          <Activity className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <span>Historical analytics</span>
        </button>

        <button
          onClick={() => setActiveTab('prediction')}
          className={`h-[36px] flex items-center gap-2 px-4 text-xs font-medium rounded-full transition-colors ${
            activeTab === 'prediction'
              ? 'bg-paper-surface text-ink border border-rule shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
              : 'text-muted hover:text-ink hover:bg-paper-surface/50 border border-transparent'
          }`}
        >
          <TrendingUp className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <span>Predictive horizon</span>
        </button>
      </nav>

      {/* Right Controls & Status (Cleaned & Collision-Free) */}
      <div className="flex items-center space-x-2">
        {/* Synthetic Fixture Mode Badge */}
        {isMockMode && (
          <div
            title="UI running with typed synthetic satellite fixtures for offline prototyping mode."
            className="hidden 2xl:flex items-center space-x-1.5 bg-paper-3 border border-rule text-muted text-xs h-[38px] px-3 rounded-control cursor-help"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-muted-2 shrink-0" />
            <span>Synthetic fixture mode</span>
          </div>
        )}

        {/* Jobs Queue Bell */}
        <button
          onClick={onOpenJobsModal}
          className="relative h-[38px] w-[38px] rounded-control bg-paper-3 hover:bg-paper-surface text-muted hover:text-ink border border-rule flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus"
          title="Analysis jobs and queue"
          aria-label="Analysis jobs and queue"
        >
          <Bell className="h-4 w-4 shrink-0" aria-hidden="true" />
          {runningJobsCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-paper-surface text-ink border border-rule font-mono tabular-nums text-xs flex items-center justify-center">
              {runningJobsCount}
            </span>
          )}
          {runningJobsCount === 0 && completedJobsCount > 0 && (
            <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-ink-2" />
          )}
        </button>

        {/* Platform Guide / Info Button */}
        <button
          onClick={onOpenInfoModal}
          className="h-[38px] w-[38px] rounded-control bg-paper-3 hover:bg-paper-surface text-muted hover:text-ink border border-rule flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus"
          title="Platform architecture and guidance"
          aria-label="Platform architecture and guidance"
        >
          <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
};

import React, { useState } from 'react';
import {
  Satellite,
  Compass,
  ArrowUpRight,
  ShieldCheck,
  Check,
  Copy,
  Layers,
  Activity,
  TrendingUp,
  Database,
  SlidersHorizontal
} from 'lucide-react';
import { BramhaIcon } from './BramhaLogo';

interface ProductOverviewHeroProps {
  onLaunchWorkspace: () => void;
  onOpenMethodology: () => void;
}

export const ProductOverviewHero: React.FC<ProductOverviewHeroProps> = ({
  onLaunchWorkspace,
  onOpenMethodology
}) => {
  const [copiedCommand, setCopiedCommand] = useState(false);
  const commandText = 'bramha monitor --aoi lake-mead --sensor sentinel-2-l2a --indicator ndvi';

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(commandText);
    setCopiedCommand(true);
    setTimeout(() => setCopiedCommand(false), 2000);
  };

  // Telemetry chart preview coordinates (W: 520, H: 210)
  const chartWidth = 520;
  const chartHeight = 210;
  const padLeft = 36;
  const padRight = 24;
  const padTop = 18;
  const padBottom = 26;
  const plotWidth = chartWidth - padLeft - padRight;
  const plotHeight = chartHeight - padTop - padBottom;

  // 12 points: 7 historical observations (Jan 2022 - Mar 2024), 5 forecast points (May 2024 - Jan 2025)
  const telemetryPoints = [
    { date: '2022-01', val: 0.74, isHist: true },
    { date: '2022-06', val: 0.79, isHist: true },
    { date: '2022-11', val: 0.71, isHist: true },
    { date: '2023-04', val: 0.77, isHist: true },
    { date: '2023-09', val: 0.69, isHist: true },
    { date: '2024-01', val: 0.65, isHist: true },
    { date: '2024-03', val: 0.642, isHist: true }, // inflection point
    { date: '2024-06', val: 0.61, upper95: 0.67, lower95: 0.55, isHist: false },
    { date: '2024-09', val: 0.57, upper95: 0.66, lower95: 0.48, isHist: false },
    { date: '2024-11', val: 0.54, upper95: 0.65, lower95: 0.43, isHist: false },
    { date: '2025-01', val: 0.52, upper95: 0.66, lower95: 0.38, isHist: false },
    { date: '2025-03', val: 0.51, upper95: 0.68, lower95: 0.34, isHist: false }
  ];

  const yMin = 0.3;
  const yMax = 0.9;
  const yRange = yMax - yMin;

  const getX = (idx: number) => padLeft + (idx / (telemetryPoints.length - 1)) * plotWidth;
  const getY = (val: number) => padTop + plotHeight - ((val - yMin) / yRange) * plotHeight;

  const histPointsStr = telemetryPoints
    .filter((_, idx) => idx <= 6)
    .map((p, i) => `${getX(i)},${getY(p.val)}`)
    .join(' ');

  const forecastPointsStr = telemetryPoints
    .filter((_, idx) => idx >= 6)
    .map((p, i) => `${getX(i + 6)},${getY(p.val)}`)
    .join(' ');

  // 95% Confidence Band Polygon
  const forecastIndices = [6, 7, 8, 9, 10, 11];
  const topBandStr = forecastIndices
    .map((idx) => {
      const p = telemetryPoints[idx];
      const val = p.upper95 || p.val;
      return `${getX(idx)},${getY(val)}`;
    })
    .join(' ');

  const bottomBandStr = [...forecastIndices]
    .reverse()
    .map((idx) => {
      const p = telemetryPoints[idx];
      const val = p.lower95 || p.val;
      return `${getX(idx)},${getY(val)}`;
    })
    .join(' ');

  const bandPolygonStr = `${topBandStr} ${bottomBandStr}`;

  return (
    <section className="relative w-full min-h-[calc(100vh-86px)] bg-paper flex flex-col justify-center px-4 sm:px-6 lg:px-12 py-6 lg:py-8 select-none overflow-y-auto">
      <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left Column: Clear Grounded Copy without Hype Words */}
        <div className="lg:col-span-5 flex flex-col space-y-6">
          {/* Subtle Category Row with Bramha Mark */}
          <div className="flex items-center space-x-2 text-xs font-mono text-muted">
            <BramhaIcon className="h-4 w-4" />
            <span className="text-[#9ec8b9] font-bold">/</span>
            <span className="text-ink font-medium tracking-normal">bramha</span>
            <span className="text-muted-2">·</span>
            <span>Earth observation telemetry</span>
          </div>

          {/* Grounded Editorial Headline (Newsreader Serif) */}
          <div className="space-y-3">
            <h1 className="font-headline text-4xl sm:text-5xl lg:text-[52px] leading-[1.06] tracking-[-0.02em] text-ink font-normal">
              Earth observation intelligence from calibrated satellite passes.
            </h1>
            <p className="text-base sm:text-lg text-ink-2 leading-relaxed max-w-xl font-body">
              Track land surface disturbance, inspect multitemporal passes across Sentinel-2 and Landsat-9, and evaluate predictive horizons with empirical confidence intervals.
            </p>
          </div>

          {/* Reproducible CLI / Data Ingestion Snippet */}
          <div className="flex items-center justify-between bg-paper-2 border border-rule px-3.5 py-2.5 rounded-control font-mono text-xs text-muted max-w-xl">
            <div className="flex items-center space-x-2 overflow-x-auto truncate">
              <span className="text-telemetry-amber select-none">$</span>
              <span className="text-ink font-mono">{commandText}</span>
            </div>
            <button
              onClick={handleCopyCommand}
              className="ml-3 shrink-0 p-1.5 rounded-sm hover:bg-paper-surface text-muted hover:text-ink transition-colors"
              title="Copy ingestion command"
              aria-label="Copy ingestion command"
            >
              {copiedCommand ? (
                <Check className="h-4 w-4 text-success" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>

          {/* Actions: Primary & Secondary with Explicit High-Contrast Styling */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={onLaunchWorkspace}
              className="h-11 px-5 rounded-control bg-[#ededed] hover:bg-white text-[#0f0f10] font-semibold text-xs flex items-center space-x-2 transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus cursor-pointer"
              style={{ color: '#0f0f10', backgroundColor: '#ededed' }}
            >
              <Compass className="h-4 w-4 shrink-0 text-[#0f0f10]" style={{ color: '#0f0f10' }} aria-hidden="true" />
              <span className="text-[#0f0f10] font-semibold text-xs" style={{ color: '#0f0f10' }}>
                Launch workspace
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenMethodology}
              className="h-11 px-5 rounded-control bg-paper-3 hover:bg-paper-surface text-ink font-medium text-xs border border-rule transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus cursor-pointer"
            >
              Inspect methodology
            </button>
          </div>

          {/* Grounded Observational Metrics (No Unverified Claims) */}
          <div className="pt-4 border-t border-rule grid grid-cols-3 gap-4 max-w-xl">
            <div>
              <div className="text-xl sm:text-2xl font-mono tabular-nums text-ink font-medium">
                4.8m km²
              </div>
              <div className="text-xs text-muted font-sans mt-0.5">
                Monitored coverage
              </div>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-mono tabular-nums text-ink font-medium">
                10m / 30m
              </div>
              <div className="text-xs text-muted font-sans mt-0.5">
                Spatial resolution
              </div>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-mono tabular-nums text-ink font-medium">
                95% CI
              </div>
              <div className="text-xs text-muted font-sans mt-0.5">
                Empirical envelope
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Code-Based Product Preview (Main Panel) */}
        <div className="lg:col-span-7 flex flex-col relative">
          {/* Dim White Ambient Lighting Glow behind Main Panel */}
          <div className="absolute -inset-1.5 rounded-2xl bg-white/[0.05] blur-2xl pointer-events-none -z-10" />

          <div className="bg-paper-2 border border-rule/80 rounded-2xl overflow-hidden flex flex-col shadow-[0_0_50px_rgba(255,255,255,0.06),0_24px_48px_rgba(0,0,0,0.6)]">
            {/* Desktop Window Chrome */}
            <div className="h-9 px-3.5 bg-paper border-b border-rule flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <span className="h-2.5 w-2.5 rounded-full bg-paper-surface border border-rule" />
                <span className="h-2.5 w-2.5 rounded-full bg-paper-surface border border-rule" />
                <span className="h-2.5 w-2.5 rounded-full bg-paper-surface border border-rule" />
                <span className="text-xs font-mono text-muted pl-2 hidden sm:inline">
                  bramha-telemetry-console — Lake Mead (36.015° N, 114.742° W)
                </span>
              </div>
              <div className="flex items-center space-x-1.5 text-xs font-mono text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                <span>Calibrated BOA</span>
              </div>
            </div>

            {/* Split Preview Body */}
            <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-rule bg-paper-2">
              {/* Left Column of Preview: Satellite Granule & Sensor Readings */}
              <div className="md:col-span-4 p-4 space-y-3 bg-paper-2">
                {/* Granule Identification */}
                <div className="p-3 rounded-card bg-paper-3 border border-rule space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-ink">Active granule</span>
                    <span className="font-mono text-muted text-xs">S2A_MSIL2A</span>
                  </div>
                  <div className="text-xs font-mono text-ink truncate bg-paper p-1.5 rounded-control border border-rule">
                    20240214T181731_R034
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[11px] font-mono tabular-nums text-muted pt-0.5">
                    <div>Cloud: <span className="text-ink">3.4%</span></div>
                    <div>Sun zen: <span className="text-ink">42.1°</span></div>
                  </div>
                </div>

                {/* Primary Biogeochemical Indicator */}
                <div className="p-3 rounded-card bg-paper-3 border border-rule space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-ink">Surface reflectance</span>
                    <span className="font-mono text-xs text-telemetry-cyan">NDVI</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-mono tabular-nums font-medium text-ink">
                      0.642
                    </span>
                    <span className="text-xs font-mono tabular-nums text-error">
                      -0.078 vs baseline
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-xs font-mono tabular-nums pt-1 border-t border-rule text-muted">
                    <div>NDWI: <span className="text-ink">-0.218</span></div>
                    <div>EVI: <span className="text-ink">0.491</span></div>
                  </div>
                </div>

                {/* Multitemporal Pass Disturbance Comparison */}
                <div className="p-3 rounded-card bg-paper-3 border border-rule space-y-1 text-xs">
                  <span className="font-medium text-ink block">Multitemporal delta</span>
                  <div className="font-mono tabular-nums text-muted text-[11px] space-y-0.5">
                    <div className="flex justify-between">
                      <span>Pass A (2023-01-15):</span>
                      <span className="text-ink">0.720</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Pass B (2024-02-14):</span>
                      <span className="text-ink">0.642</span>
                    </div>
                    <div className="flex justify-between text-error pt-1 border-t border-rule">
                      <span>Disturbance delta:</span>
                      <span className="font-medium">-0.078</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column of Preview: High-Fidelity Focal Telemetry SVG Chart */}
              <div className="md:col-span-8 p-4 flex flex-col justify-between space-y-3 bg-paper-3/40">
                {/* Chart Header & Legend */}
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="font-medium text-ink block">
                      Temporal trajectory & predictive horizon
                    </span>
                    <span className="text-xs text-muted-2 font-mono">
                      Sentinel-2 MSI Level-2A · Empirical ARIMA projection
                    </span>
                  </div>
                  <div className="hidden sm:flex items-center space-x-3 text-[11px] font-mono">
                    <div className="flex items-center space-x-1">
                      <span className="h-1.5 w-3 bg-telemetry-cyan rounded-sm" />
                      <span className="text-muted">Observed</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="h-1.5 w-3 bg-telemetry-amber rounded-sm" />
                      <span className="text-muted">Forecast</span>
                    </div>
                  </div>
                </div>

                {/* SVG Telemetry Chart Moment */}
                <div className="relative bg-paper-2 rounded-card border border-rule p-2.5 overflow-hidden">
                  <svg
                    role="img"
                    aria-label="Observed satellite passes and forecast horizon with confidence interval"
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    className="w-full h-auto overflow-visible select-none"
                  >
                    {/* Vertical Dividing Reference (Present Day Observation) */}
                    <line
                      x1={getX(6)}
                      y1={padTop}
                      x2={getX(6)}
                      y2={chartHeight - padBottom}
                      stroke="var(--color-telemetry-amber)"
                      strokeWidth="1"
                      strokeDasharray="3,3"
                      strokeOpacity="0.5"
                    />
                    <text
                      x={getX(6) + 6}
                      y={padTop + 10}
                      fill="var(--color-telemetry-amber)"
                      fontSize="9"
                      fontFamily="var(--font-outlier)"
                    >
                      Projection horizon →
                    </text>

                    {/* Muted Grid Lines */}
                    {[0.4, 0.6, 0.8].map((val) => {
                      const y = getY(val);
                      return (
                        <g key={val}>
                          <line
                            x1={padLeft}
                            y1={y}
                            x2={chartWidth - padRight}
                            y2={y}
                            stroke="var(--color-rule)"
                            strokeDasharray="2,2"
                          />
                          <text
                            x={padLeft - 6}
                            y={y + 3}
                            fill="var(--color-muted-2)"
                            fontSize="9"
                            fontFamily="var(--font-outlier)"
                            textAnchor="end"
                          >
                            {val.toFixed(1)}
                          </text>
                        </g>
                      );
                    })}

                    {/* 95% Confidence Interval Band (Translucent Amber Fill) */}
                    <polygon
                      points={bandPolygonStr}
                      fill="var(--color-telemetry-amber)"
                      fillOpacity="0.12"
                      stroke="var(--color-telemetry-amber)"
                      strokeWidth="0.5"
                      strokeOpacity="0.3"
                    />

                    {/* Historical Observed Solid Cyan Line */}
                    <polyline
                      fill="none"
                      stroke="var(--color-telemetry-cyan)"
                      strokeWidth="2"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      points={histPointsStr}
                    />

                    {/* Forecast Horizon Dashed Amber Line */}
                    <polyline
                      fill="none"
                      stroke="var(--color-telemetry-amber)"
                      strokeWidth="2"
                      strokeDasharray="4,3"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      points={forecastPointsStr}
                    />

                    {/* Historical Observation Node Points */}
                    {telemetryPoints.map((p, idx) => {
                      const cx = getX(idx);
                      const cy = getY(p.val);
                      if (p.isHist) {
                        const isInflection = idx === 6;
                        return (
                          <g key={idx}>
                            <circle
                              cx={cx}
                              cy={cy}
                              r={isInflection ? 4 : 2.5}
                              fill="var(--color-paper-2)"
                              stroke="var(--color-telemetry-cyan)"
                              strokeWidth={isInflection ? 2 : 1.5}
                            />
                            {isInflection && (
                              <g>
                                <rect
                                  x={cx - 40}
                                  y={cy - 26}
                                  width="80"
                                  height="18"
                                  rx="3"
                                  fill="var(--color-paper-surface)"
                                  stroke="var(--color-rule-2)"
                                />
                                <text
                                  x={cx}
                                  y={cy - 14}
                                  fill="var(--color-ink)"
                                  fontSize="9"
                                  fontFamily="var(--font-outlier)"
                                  textAnchor="middle"
                                >
                                  0.642 (Latest)
                                </text>
                              </g>
                            )}
                          </g>
                        );
                      }
                      return (
                        <circle
                          key={idx}
                          cx={cx}
                          cy={cy}
                          r={2.5}
                          fill="var(--color-paper-2)"
                          stroke="var(--color-telemetry-amber)"
                          strokeWidth="1.5"
                        />
                      );
                    })}

                    {/* X-Axis Date Ticks */}
                    {telemetryPoints.map((p, idx) => {
                      if (idx % 2 !== 0 && idx !== telemetryPoints.length - 1) return null;
                      return (
                        <text
                          key={idx}
                          x={getX(idx)}
                          y={chartHeight - 8}
                          fill={p.isHist ? 'var(--color-muted-2)' : 'var(--color-telemetry-amber)'}
                          fontSize="9"
                          fontFamily="var(--font-outlier)"
                          textAnchor="middle"
                        >
                          {p.date}
                        </text>
                      );
                    })}
                  </svg>
                </div>

                {/* Direct Console Invocation Link */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-muted font-sans">
                    Showing Lake Mead multitemporal NDVI fixture
                  </span>
                  <button
                    onClick={onLaunchWorkspace}
                    className="text-xs font-medium text-ink hover:text-white flex items-center space-x-1 transition-colors"
                  >
                    <span>Interact in workspace</span>
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>

            {/* Window Footer Status */}
            <div className="h-8 px-3.5 bg-paper border-t border-rule flex items-center justify-between text-xs font-mono text-muted-2 shrink-0">
              <div className="flex items-center space-x-3">
                <span>STAC query: 184ms</span>
                <span>BBOX: [-114.85, 35.95, -114.65, 36.15]</span>
              </div>
              <div>EPSG:4326 (WGS84) · Validated</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};


import React, { useState } from 'react';
import {
  Activity,
  AlertCircle,
  Table,
  CheckCircle,
  TrendingDown,
  TrendingUp,
  Download,
  Info,
  Calendar,
  Cloud
} from 'lucide-react';
import { TimeSeriesPoint, ChangeEvent } from '../types/api';

interface TimeSeriesChartProps {
  observations: TimeSeriesPoint[];
  changes: ChangeEvent[];
  indicator: string;
  phenomenon: string;
}

export const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
  observations,
  changes,
  indicator,
  phenomenon
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<TimeSeriesPoint | null>(null);
  const [showDataTable, setShowDataTable] = useState(false);

  if (!observations || observations.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 bg-slate-900/40 rounded-lg border border-dashed border-slate-700">
        <Activity className="h-6 w-6 text-slate-500 mx-auto mb-2" />
        <div className="text-xs font-semibold text-slate-300">No Time-Series Observations Loaded</div>
        <p className="text-[11px] text-slate-500 mt-1">
          Submit an analysis job or select an AOI to generate historical time series.
        </p>
      </div>
    );
  }

  // Chart dimensions & coordinates calculation for crisp SVG rendering
  const values = observations.map((d) => (typeof d.value === 'number' && !isNaN(d.value) ? d.value : 0));
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const padding = (maxVal - minVal) * 0.15 || 0.1;
  const yMin = Number((minVal - padding).toFixed(2));
  const yMax = Number((maxVal + padding).toFixed(2));
  const yRange = yMax - yMin || 1;

  const width = 600;
  const height = 220;
  const padLeft = 45;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 30;

  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  const getX = (index: number) => {
    return padLeft + (index / (observations.length - 1 || 1)) * plotWidth;
  };

  const getY = (val: number) => {
    return padTop + plotHeight - ((val - yMin) / yRange) * plotHeight;
  };

  // Generate SVG Path for the observed line
  const linePoints = observations.map((d, i) => `${getX(i)},${getY(d.value)}`).join(' ');

  // Compute stats
  const validObservations = observations.filter((d) => d.qualityFlag === 'valid');
  const avgValue = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(3);

  // Export CSV
  const handleExportCsv = () => {
    const headers = ['Timestamp', 'Indicator', 'Value', 'Unit', 'QualityFlag', 'ValidObsCount', 'SourceRef'];
    const rows = observations.map((o) =>
      [o.timestamp, indicator, o.value, o.unit, o.qualityFlag, o.validObservationCount, o.sourceReference].join(',')
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${indicator}_timeseries_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-3 select-none">
      {/* Header with Quick Stats & Actions */}
      <div className="flex items-center justify-between">
        <div>
          <span className="font-semibold text-slate-200 block text-xs">
            Historical Time Series ({observations.length} Observations)
          </span>
          <span className="text-[10px] text-slate-400">
            {indicator.toUpperCase()} • Valid passes: {validObservations.length} / {observations.length}
          </span>
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setShowDataTable(!showDataTable)}
            className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-geo-border text-xs flex items-center space-x-1"
            title="Inspect Underlying Observation Data Table"
          >
            <Table className="h-3.5 w-3.5" />
            <span className="text-[11px] font-mono">{showDataTable ? 'Chart' : 'Data'}</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-geo-border text-xs flex items-center space-x-1"
            title="Export CSV"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="text-[11px] font-mono">CSV</span>
          </button>
        </div>
      </div>

      {!showDataTable ? (
        /* SVG Interactive Chart */
        <div className="relative bg-slate-900/90 border border-geo-border rounded-lg p-2 overflow-hidden shadow-inner">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto overflow-visible cursor-crosshair"
          >
            {/* Grid Lines */}
            {[0, 0.25, 0.5, 0.75, 1.0].map((ratio) => {
              const y = padTop + plotHeight * (1 - ratio);
              const labelVal = (yMin + yRange * ratio).toFixed(2);
              return (
                <g key={ratio}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={width - padRight}
                    y2={y}
                    stroke="#1e293b"
                    strokeDasharray="3,3"
                  />
                  <text
                    x={padLeft - 8}
                    y={y + 3}
                    fill="#64748b"
                    fontSize="9"
                    fontFamily="monospace"
                    textAnchor="end"
                  >
                    {labelVal}
                  </text>
                </g>
              );
            })}

            {/* X-axis Date Labels */}
            {observations.map((d, i) => {
              if (i % Math.ceil(observations.length / 5) !== 0 && i !== observations.length - 1) return null;
              const x = getX(i);
              return (
                <text
                  key={i}
                  x={x}
                  y={height - 8}
                  fill="#64748b"
                  fontSize="9"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {d.timestamp.slice(2, 7)}
                </text>
              );
            })}

            {/* Observed Trend Solid Line */}
            <polyline
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={linePoints}
            />

            {/* Data Points */}
            {observations.map((d, i) => {
              const cx = getX(i);
              const cy = getY(d.value);
              const isCloudy = d.qualityFlag === 'cloud_masked';
              const isAnomaly = d.anomaly;
              const isHovered = hoveredPoint?.timestamp === d.timestamp;

              return (
                <g
                  key={i}
                  className="cursor-pointer transition-transform"
                  onMouseEnter={() => setHoveredPoint(d)}
                >
                  {/* Outer circle for anomaly / cloud */}
                  {isAnomaly && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r="7"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="1.5"
                      className="animate-ping"
                    />
                  )}

                  {/* Core point */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isHovered ? 5 : isAnomaly ? 4.5 : 3}
                    fill={isCloudy ? '#f43f5e' : isAnomaly ? '#ef4444' : '#38bdf8'}
                    stroke="#0b0f19"
                    strokeWidth="1.5"
                  />
                </g>
              );
            })}
          </svg>

          {/* Active Hover Tooltip */}
          {hoveredPoint && (
            <div className="absolute top-2 right-2 bg-slate-950/95 border border-teal-500/60 p-2 rounded-md shadow-2xl text-[10px] font-mono space-y-1 backdrop-blur-sm pointer-events-none">
              <div className="flex items-center justify-between text-teal-300 font-bold border-b border-slate-800 pb-1">
                <span>{hoveredPoint.timestamp.slice(0, 10)}</span>
                <span className="text-slate-400 font-normal">
                  {hoveredPoint.sourceReference.split('_')[0]}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Value:</span>
                <span className="text-white font-bold">{hoveredPoint.value} {hoveredPoint.unit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Quality:</span>
                <span
                  className={
                    hoveredPoint.qualityFlag === 'valid' ? 'text-emerald-400' : 'text-rose-400'
                  }
                >
                  {hoveredPoint.qualityFlag}
                </span>
              </div>
              {hoveredPoint.anomalyDescription && (
                <div className="text-rose-300 bg-rose-950/60 p-1 rounded text-[9px] mt-1 border border-rose-800/40">
                  {hoveredPoint.anomalyDescription}
                </div>
              )}
            </div>
          )}

          {/* Legend row */}
          <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400 px-1">
            <div className="flex items-center space-x-3">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-0.5 bg-[#38bdf8] inline-block" />
                Observed Sentinel/Landsat
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                Cloud Masked
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                Detected Anomaly
              </span>
            </div>
            <span>Mean: {avgValue}</span>
          </div>
        </div>
      ) : (
        /* Underlying Data Table (Section 4.D Requirement) */
        <div className="bg-slate-900/90 border border-geo-border rounded-lg overflow-hidden max-h-[260px] overflow-y-auto">
          <table className="w-full text-[10px] font-mono text-left text-slate-300">
            <thead className="bg-slate-800/80 text-slate-400 uppercase tracking-wider sticky top-0">
              <tr>
                <th className="p-2">Date (UTC)</th>
                <th className="p-2">Obs Value</th>
                <th className="p-2">Quality</th>
                <th className="p-2">Count</th>
                <th className="p-2">Granule Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {observations.map((d, i) => (
                <tr key={i} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-2 text-teal-300 font-semibold">{d.timestamp.slice(0, 10)}</td>
                  <td className="p-2 text-slate-100 font-bold">{d.value}</td>
                  <td className="p-2">
                    <span
                      className={`px-1 py-0.5 rounded text-[9px] ${
                        d.qualityFlag === 'valid'
                          ? 'bg-emerald-950 text-emerald-300'
                          : 'bg-rose-950 text-rose-300'
                      }`}
                    >
                      {d.qualityFlag}
                    </span>
                  </td>
                  <td className="p-2 text-slate-400">{d.validObservationCount}</td>
                  <td className="p-2 text-slate-400 truncate max-w-[120px]" title={d.sourceReference}>
                    {d.sourceReference}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Change Events & Dated Anomalies */}
      {changes && changes.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
            Detected Change Events & Disturbances
          </span>
          <div className="space-y-1.5">
            {changes.map((chg) => (
              <div
                key={chg.id}
                className="p-2 rounded-lg bg-slate-900/60 border border-geo-border text-[11px] space-y-1 hover:border-slate-600 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    {chg.changeType === 'abrupt_drop' && <TrendingDown className="h-3.5 w-3.5 text-rose-400" />}
                    {chg.changeType === 'rapid_growth' && <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />}
                    {chg.changeType === 'water_inundation' && <Activity className="h-3.5 w-3.5 text-cyan-400" />}
                    {chg.changeType.replace('_', ' ').toUpperCase()}
                  </span>
                  <span className="font-mono text-[10px] text-teal-400 font-semibold">
                    {chg.date}
                  </span>
                </div>
                <p className="text-slate-400 text-[10px] leading-relaxed">{chg.description}</p>
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-0.5">
                  <span>Confidence: {chg.confidencePct}%</span>
                  {chg.affectedAreaSqKm && <span>Area: ~{chg.affectedAreaSqKm} km²</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};


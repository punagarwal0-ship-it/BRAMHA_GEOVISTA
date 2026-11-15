import React, { useEffect, useState } from 'react';
import {
  Layers,
  MapPin,
  Activity,
  TrendingUp,
  SplitSquareVertical,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Info,
  Calendar,
  Cloud,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import {
  AOI,
  ObservationScene,
  TimeSeriesPoint,
  ChangeEvent,
  ForecastPoint,
  ForecastModelMetadata,
  LayerDefinition,
  AnalysisJob,
  PhenomenonType
} from './types/api';
import { CURATED_AOIS, PHENOMENA_CONFIGS, SUPPORTED_COLLECTIONS } from './services/mockData';
import { apiAdapter } from './services/apiAdapter';
import { TopNav } from './components/TopNav';
import { MapCanvas } from './components/MapCanvas';
import { AOITools } from './components/AOITools';
import { LayerPanel } from './components/LayerPanel';
import { SceneResults } from './components/SceneResults';
import { TimeSlider } from './components/TimeSlider';
import { CompareViewer } from './components/CompareViewer';
import { AnalysisPanel } from './components/AnalysisPanel';
import { InfoModal } from './components/InfoModal';

export const App: React.FC = () => {
  // Navigation & View State
  const [activeNavTab, setActiveNavTab] = useState<'workspace' | 'catalog' | 'analytics' | 'prediction'>('workspace');
  const [leftTab, setLeftTab] = useState<'aoi' | 'layers' | 'catalog' | 'compare'>('aoi');
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  // AOI State
  const [activeAoi, setActiveAoi] = useState<AOI | null>(CURATED_AOIS[0]);
  const [drawingMode, setDrawingMode] = useState<'none' | 'polygon' | 'box' | 'point'>('none');
  const [pointBufferKm, setPointBufferKm] = useState<number>(15);

  // Analysis Configuration State
  const [phenomenon, setPhenomenon] = useState<PhenomenonType>('vegetation');
  const [indicator, setIndicator] = useState<string>('ndvi');
  const [selectedCollections, setSelectedCollections] = useState<string[]>([
    'sentinel-2-l2a',
    'landsat-9-c2l2'
  ]);
  const [dateRange, setDateRange] = useState({
    startDate: '2022-01-01',
    endDate: '2024-03-01'
  });
  const [aggregation, setAggregation] = useState<'daily' | '5day' | 'monthly' | 'seasonal' | 'annual'>('monthly');
  const [maxCloudCover, setMaxCloudCover] = useState<number>(30);
  const [activeBaseMap, setActiveBaseMap] = useState<'satellite' | 'dark' | 'osm'>('satellite');

  // Satellite Catalog & Temporal State
  const [scenes, setScenes] = useState<ObservationScene[]>([]);
  const [selectedScene, setSelectedScene] = useState<ObservationScene | null>(null);
  const [activeSceneIndex, setActiveSceneIndex] = useState<number>(0);
  const [isPlayingAnimation, setIsPlayingAnimation] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(false);

  // Compare Swipe State
  const [compareMode, setCompareMode] = useState<boolean>(false);
  const [compareDateA, setCompareDateA] = useState<string>('2023-01-15');
  const [compareDateB, setCompareDateB] = useState<string>('2024-02-14');

  // Layers Stack
  const [layers, setLayers] = useState<LayerDefinition[]>([]);

  // Asynchronous Jobs & Analytical Results
  const [jobs, setJobs] = useState<AnalysisJob[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [isSubmittingJob, setIsSubmittingJob] = useState<boolean>(false);
  const [observations, setObservations] = useState<TimeSeriesPoint[]>([]);
  const [changes, setChanges] = useState<ChangeEvent[]>([]);
  const [forecast, setForecast] = useState<ForecastPoint[]>([]);
  const [forecastMetadata, setForecastMetadata] = useState<ForecastModelMetadata | null>(null);

  // Update Phenomenon & Indicator Sync
  const handlePhenomenonChange = (newPhenomenon: PhenomenonType) => {
    setPhenomenon(newPhenomenon);
    const cfg = PHENOMENA_CONFIGS[newPhenomenon];
    if (cfg) {
      setIndicator(cfg.defaultIndicator);
    }
  };

  // Toggle Satellite Collection Checkbox
  const handleToggleCollection = (id: string) => {
    if (selectedCollections.includes(id)) {
      if (selectedCollections.length > 1) {
        setSelectedCollections(selectedCollections.filter((c) => c !== id));
      }
    } else {
      setSelectedCollections([...selectedCollections, id]);
    }
  };

  // Query Catalog when AOI or Filters Change
  const fetchCatalog = async () => {
    if (!activeAoi) return;
    setIsLoadingCatalog(true);
    try {
      const results = await apiAdapter.searchCatalog({
        aoi: activeAoi.geometry,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        collections: selectedCollections,
        maxCloudCover
      });
      setScenes(results);
      if (results.length > 0) {
        setSelectedScene(results[0]);
        setActiveSceneIndex(0);
        if (results[0]) setCompareDateA(results[0].acquiredAt.slice(0, 10));
        if (results[results.length - 1]) setCompareDateB(results[results.length - 1].acquiredAt.slice(0, 10));
      }
    } catch (err) {
      console.error('Failed to load catalog:', err);
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  // Initial Data Load
  useEffect(() => {
    fetchCatalog();
    loadJobs();
  }, [activeAoi]);

  // Load existing jobs and hydrate analytical results
  const loadJobs = async () => {
    try {
      const allJobs = await apiAdapter.getAllJobs();
      setJobs(allJobs);
      if (allJobs.length > 0 && !activeJobId) {
        handleSelectJob(allJobs[0].id);
      }
    } catch (err) {
      console.error('Failed to load jobs:', err);
    }
  };

  // Select Job & Hydrate Analytical Data
  const handleSelectJob = async (jobId: string) => {
    setActiveJobId(jobId);
    try {
      const [obs, chgs, fc, lyr] = await Promise.all([
        apiAdapter.getJobObservations(jobId),
        apiAdapter.getJobChanges(jobId),
        apiAdapter.getJobForecast(jobId),
        apiAdapter.getJobLayers(jobId)
      ]);
      setObservations(obs);
      setChanges(chgs);
      setForecast(fc.forecast);
      setForecastMetadata(fc.metadata);
      setLayers(lyr);
    } catch (err) {
      console.warn('Could not hydrate job data:', err);
    }
  };

  // Submit New Analysis Job
  const handleSubmitNewJob = async (
    edgeCase: 'normal' | 'insufficient_history' | 'cloud_failure' | 'partial_data' = 'normal'
  ) => {
    if (!activeAoi) return;
    setIsSubmittingJob(true);
    try {
      const newJob = await apiAdapter.submitAnalysisJob({
        aoi: activeAoi,
        phenomenon,
        indicator,
        dateRange,
        aggregation,
        edgeCaseSim: edgeCase
      });

      setActiveJobId(newJob.id);
      await loadJobs();

      // Poll job status until complete
      const pollInterval = setInterval(async () => {
        try {
          const updated = await apiAdapter.getJobStatus(newJob.id);
          setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));

          if (updated.status === 'completed' || updated.status === 'failed' || updated.status === 'partial_data') {
            clearInterval(pollInterval);
            setIsSubmittingJob(false);
            if (updated.status !== 'failed') {
              handleSelectJob(updated.id);
            }
          }
        } catch {
          clearInterval(pollInterval);
          setIsSubmittingJob(false);
        }
      }, 1000);
    } catch (err) {
      console.error('Failed to submit job:', err);
      setIsSubmittingJob(false);
    }
  };

  // Layer Toggles
  const handleToggleLayerVisibility = (layerId: string) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, visible: !l.visible } : l))
    );
  };

  const handleChangeLayerOpacity = (layerId: string, opacity: number) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, opacity } : l))
    );
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-geo-bg text-slate-100 font-sans">
      {/* Top Application Navigation */}
      <TopNav
        activeAoi={activeAoi}
        activeTab={activeNavTab}
        setActiveTab={(tab) => {
          setActiveNavTab(tab);
          if (tab === 'catalog') {
            setLeftTab('catalog');
            setIsLeftCollapsed(false);
          } else if (tab === 'analytics' || tab === 'prediction') {
            setIsRightCollapsed(false);
          }
        }}
        jobs={jobs}
        onOpenJobsModal={() => {
          setIsRightCollapsed(false);
        }}
        onOpenInfoModal={() => setIsInfoModalOpen(true)}
        isMockMode={true}
      />

      {/* Main Workspace Body */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Left Control Panel (Collapsible / Resizable) */}
        {!isLeftCollapsed ? (
          <aside className="w-80 md:w-96 bg-slate-900/95 border-r border-geo-border flex flex-col z-20 backdrop-blur-md overflow-hidden select-none shadow-2xl">
            {/* Left Header with Tabs */}
            <div className="h-12 border-b border-geo-border px-3 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-1 bg-slate-950/70 p-1 rounded-lg border border-geo-border text-xs">
                <button
                  onClick={() => setLeftTab('aoi')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    leftTab === 'aoi'
                      ? 'bg-geo-accent text-slate-900 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  AOI
                </button>
                <button
                  onClick={() => setLeftTab('layers')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    leftTab === 'layers'
                      ? 'bg-geo-accent text-slate-900 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Phenomena
                </button>
                <button
                  onClick={() => setLeftTab('catalog')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    leftTab === 'catalog'
                      ? 'bg-geo-accent text-slate-900 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Catalog
                </button>
                <button
                  onClick={() => setLeftTab('compare')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    leftTab === 'compare'
                      ? 'bg-teal-500 text-slate-900 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Compare
                </button>
              </div>

              <button
                onClick={() => setIsLeftCollapsed(true)}
                className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                title="Collapse Control Panel"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>

            {/* Left Tab Contents */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {leftTab === 'aoi' && (
                <AOITools
                  activeAoi={activeAoi}
                  onAoiChange={(newAoi) => {
                    setActiveAoi(newAoi);
                  }}
                  drawingMode={drawingMode}
                  setDrawingMode={setDrawingMode}
                  pointBufferKm={pointBufferKm}
                  setPointBufferKm={setPointBufferKm}
                />
              )}

              {leftTab === 'layers' && (
                <LayerPanel
                  phenomenon={phenomenon}
                  onPhenomenonChange={handlePhenomenonChange}
                  indicator={indicator}
                  onIndicatorChange={setIndicator}
                  selectedCollections={selectedCollections}
                  onToggleCollection={handleToggleCollection}
                  dateRange={dateRange}
                  onDateRangeChange={setDateRange}
                  aggregation={aggregation}
                  onAggregationChange={setAggregation}
                  maxCloudCover={maxCloudCover}
                  onMaxCloudCoverChange={setMaxCloudCover}
                  activeBaseMap={activeBaseMap}
                  onBaseMapChange={setActiveBaseMap}
                  layers={layers}
                  onToggleLayerVisibility={handleToggleLayerVisibility}
                  onChangeLayerOpacity={handleChangeLayerOpacity}
                />
              )}

              {leftTab === 'catalog' && (
                <SceneResults
                  scenes={scenes}
                  selectedScene={selectedScene}
                  onSceneSelect={setSelectedScene}
                  isLoading={isLoadingCatalog}
                  onRefreshCatalog={fetchCatalog}
                />
              )}

              {leftTab === 'compare' && (
                <CompareViewer
                  scenes={scenes}
                  compareDateA={compareDateA}
                  setCompareDateA={setCompareDateA}
                  compareDateB={compareDateB}
                  setCompareDateB={setCompareDateB}
                  compareMode={compareMode}
                  setCompareMode={setCompareMode}
                  indicator={indicator}
                />
              )}
            </div>
          </aside>
        ) : (
          /* Collapsed Pill Button */
          <div className="absolute left-0 top-14 bottom-0 w-10 bg-slate-900/95 border-r border-geo-border flex flex-col items-center py-3 space-y-4 z-20 backdrop-blur-md">
            <button
              onClick={() => setIsLeftCollapsed(false)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-400 transition-colors"
              title="Expand Controls"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="writing-vertical text-slate-400 text-xs font-semibold tracking-wider uppercase rotate-180">
              Control Panel
            </div>
          </div>
        )}

        {/* Central Map Canvas Area */}
        <main className="flex-1 flex flex-col relative h-full overflow-hidden">
          <div className="flex-1 relative">
            <MapCanvas
              activeAoi={activeAoi}
              onAoiChange={setActiveAoi}
              scenes={scenes}
              selectedScene={selectedScene}
              onSceneSelect={setSelectedScene}
              layers={layers}
              activeBaseMap={activeBaseMap}
              drawingMode={drawingMode}
              onDrawingComplete={() => setDrawingMode('none')}
              compareMode={compareMode}
              compareDateA={compareDateA}
              compareDateB={compareDateB}
              pointBufferKm={pointBufferKm}
            />
          </div>

          {/* Bottom Temporal Timeline & Scrubber */}
          <TimeSlider
            scenes={scenes}
            activeSceneIndex={activeSceneIndex}
            onSelectSceneIndex={(idx) => {
              setActiveSceneIndex(idx);
              const target = scenes[idx];
              if (target) setSelectedScene(target);
            }}
            isPlaying={isPlayingAnimation}
            onTogglePlay={() => setIsPlayingAnimation(!isPlayingAnimation)}
            playbackSpeed={playbackSpeed}
            onChangeSpeed={setPlaybackSpeed}
          />
        </main>

        {/* Right Analysis Panel */}
        <AnalysisPanel
          activeAoi={activeAoi}
          selectedScene={selectedScene}
          phenomenon={phenomenon}
          indicator={indicator}
          observations={observations}
          changes={changes}
          forecast={forecast}
          forecastMetadata={forecastMetadata}
          jobs={jobs}
          activeJobId={activeJobId}
          onSelectJob={handleSelectJob}
          onSubmitNewJob={handleSubmitNewJob}
          isSubmittingJob={isSubmittingJob}
          isCollapsed={isRightCollapsed}
          onToggleCollapse={() => setIsRightCollapsed(!isRightCollapsed)}
        />
      </div>

      {/* Guidance & Architecture Info Modal */}
      <InfoModal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)} />
    </div>
  );
};

export default App;


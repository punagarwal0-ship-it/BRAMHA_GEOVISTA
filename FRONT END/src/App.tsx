import React, { useEffect, useState } from 'react';
import {
  Layers,
  MapPin,
  Activity,
  TrendingUp,
  SplitSquareVertical,
  ChevronLeft,
  ChevronRight,
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
  PhenomenonType,
  UploadedDataset,
  DatasetRecord,
  DatasetFieldMapping
} from './types/api';
import { CURATED_AOIS, PHENOMENA_CONFIGS, SUPPORTED_COLLECTIONS } from './services/mockData';
import { apiAdapter } from './services/apiAdapter';
import { SAMPLE_DATASETS, DatasetParserService } from './services/datasetParser';
import { TopNav } from './components/TopNav';
import { MapCanvas } from './components/MapCanvas';
import { AOITools } from './components/AOITools';
import { LayerPanel } from './components/LayerPanel';
import { SceneResults } from './components/SceneResults';
import { TimeSlider } from './components/TimeSlider';
import { DatasetUploader } from './components/DatasetUploader';
import { DatasetSummary } from './components/DatasetSummary';
import { DatasetFieldMapper } from './components/DatasetFieldMapper';
import { DatasetCompareViewer } from './components/DatasetCompareViewer';
import { DatasetRecordEditorModal } from './components/DatasetRecordEditorModal';
import { AnalysisPanel } from './components/AnalysisPanel';
import { InfoModal } from './components/InfoModal';
import { ProductOverviewHero } from './components/ProductOverviewHero';

export const App: React.FC = () => {
  // Navigation & View State
  const [activeNavTab, setActiveNavTab] = useState<'overview' | 'workspace' | 'catalog' | 'analytics' | 'prediction'>('overview');
  const [leftTab, setLeftTab] = useState<'aoi' | 'dataset' | 'compare' | 'layers' | 'catalog'>('dataset');
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isFieldMapperOpen, setIsFieldMapperOpen] = useState(false);

  // Uploaded Dataset State (Strictly drives the Comparison Viewer)
  const [uploadedDataset, setUploadedDataset] = useState<UploadedDataset | null>(null);
  const [selectedRecordA, setSelectedRecordA] = useState<DatasetRecord | null>(null);
  const [selectedRecordB, setSelectedRecordB] = useState<DatasetRecord | null>(null);
  const [swipePosition, setSwipePosition] = useState<number>(50);

  // Picture & Record Editing State
  const [editingRecord, setEditingRecord] = useState<DatasetRecord | null>(null);
  const [isEditorModalOpen, setIsEditorModalOpen] = useState<boolean>(false);

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

  // Handle Dataset Ingestion (Brief Section 4.C & 4.D)
  const handleDatasetLoaded = (parsed: UploadedDataset) => {
    setUploadedDataset(parsed);
    if (parsed.records.length >= 2) {
      setSelectedRecordA(parsed.records[0]);
      setSelectedRecordB(parsed.records[parsed.records.length - 1]);
      setCompareMode(true);

      // Hydrate time series chart observations if dataset has numeric values
      const dsObs: TimeSeriesPoint[] = parsed.records
        .filter((r) => r.value !== undefined)
        .map((r) => ({
          timestamp: r.timestamp,
          value: r.value!,
          unit: r.unit || 'index',
          qualityFlag: 'valid',
          validObservationCount: 1,
          sourceReference: r.sourceReference || parsed.name
        }));
      if (dsObs.length > 0) {
        setObservations(dsObs);
      }
    } else if (parsed.records.length === 1) {
      setSelectedRecordA(parsed.records[0]);
      setSelectedRecordB(null);
      setCompareMode(false);
    } else {
      setSelectedRecordA(null);
      setSelectedRecordB(null);
      setCompareMode(false);
    }
  };

  const handleClearDataset = () => {
    setUploadedDataset(null);
    setSelectedRecordA(null);
    setSelectedRecordB(null);
    setCompareMode(false);
  };

  const handleApplyFieldMapping = (newMapping: DatasetFieldMapping) => {
    if (!uploadedDataset) return;
    const remapped = DatasetParserService.remapDataset(uploadedDataset, newMapping);
    handleDatasetLoaded(remapped);
  };

  // Picture & Record Editing Handlers
  const handleEditRecord = (record: DatasetRecord) => {
    setEditingRecord(record);
    setIsEditorModalOpen(true);
  };

  const handleSaveRecord = (updated: DatasetRecord) => {
    if (!uploadedDataset || !editingRecord) return;

    const updatedRecords = uploadedDataset.records.map((r) =>
      r.recordId === editingRecord.recordId ? updated : r
    );

    // Sort chronologically
    updatedRecords.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const start = updatedRecords[0]?.timestamp.slice(0, 10) || '';
    const end = updatedRecords[updatedRecords.length - 1]?.timestamp.slice(0, 10) || '';

    const newDataset: UploadedDataset = {
      ...uploadedDataset,
      records: updatedRecords,
      dateRange: { start, end }
    };

    setUploadedDataset(newDataset);

    // Keep selectedRecordA and selectedRecordB in sync
    if (selectedRecordA?.recordId === editingRecord.recordId) {
      setSelectedRecordA(updated);
    }
    if (selectedRecordB?.recordId === editingRecord.recordId) {
      setSelectedRecordB(updated);
    }

    // Hydrate time series chart observations
    const dsObs: TimeSeriesPoint[] = updatedRecords
      .filter((r) => r.value !== undefined)
      .map((r) => ({
        timestamp: r.timestamp,
        value: r.value!,
        unit: r.unit || 'index',
        qualityFlag: 'valid',
        validObservationCount: 1,
        sourceReference: r.sourceReference || newDataset.name
      }));
    if (dsObs.length > 0) {
      setObservations(dsObs);
    }
  };

  const handleDeleteRecord = (recordId: string) => {
    if (!uploadedDataset) return;
    const remaining = uploadedDataset.records.filter((r) => r.recordId !== recordId);
    if (remaining.length === 0) {
      handleClearDataset();
      return;
    }

    const start = remaining[0]?.timestamp.slice(0, 10) || '';
    const end = remaining[remaining.length - 1]?.timestamp.slice(0, 10) || '';

    const newDataset: UploadedDataset = {
      ...uploadedDataset,
      records: remaining,
      dateRange: { start, end }
    };

    setUploadedDataset(newDataset);

    if (selectedRecordA?.recordId === recordId) {
      setSelectedRecordA(remaining[0] || null);
    }
    if (selectedRecordB?.recordId === recordId) {
      setSelectedRecordB(remaining.length > 1 ? remaining[remaining.length - 1] : null);
    }

    const dsObs: TimeSeriesPoint[] = remaining
      .filter((r) => r.value !== undefined)
      .map((r) => ({
        timestamp: r.timestamp,
        value: r.value!,
        unit: r.unit || 'index',
        qualityFlag: 'valid',
        validObservationCount: 1,
        sourceReference: r.sourceReference || newDataset.name
      }));
    setObservations(dsObs);
  };

  const handleAddPicturesToDataset = async (files: FileList | File[]) => {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    try {
      if (uploadedDataset) {
        const updated = await DatasetParserService.appendImageFiles(uploadedDataset, fileList);
        handleDatasetLoaded(updated);
      } else {
        const parsed = await DatasetParserService.parseImageFiles(fileList);
        handleDatasetLoaded(parsed);
      }
    } catch (err) {
      console.error('Failed to add pictures to dataset:', err);
    }
  };

  // Initial Sample Dataset Load (Lake Mead Multitemporal NDVI)
  useEffect(() => {
    const sample = SAMPLE_DATASETS[0];
    const size = new Blob([sample.data]).size;
    const initialDataset = DatasetParserService.parseDataset(
      `${sample.label}.${sample.format}`,
      sample.data,
      size,
      sample.format
    );
    initialDataset.isDemoSample = true;
    handleDatasetLoaded(initialDataset);
  }, []);

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
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-paper text-ink font-sans">
      {/* Top Application Navigation */}
      <TopNav
        activeAoi={activeAoi}
        activeDataset={uploadedDataset}
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

      {/* Main Workspace Body or Product Overview Hero */}
      {activeNavTab === 'overview' ? (
        <ProductOverviewHero
          onLaunchWorkspace={() => setActiveNavTab('workspace')}
          onOpenMethodology={() => setIsInfoModalOpen(true)}
        />
      ) : (
        <div className="flex-1 flex relative overflow-hidden">
        {/* Left Control Panel (Collapsible / Resizable) */}
        {!isLeftCollapsed ? (
          <aside className="w-80 md:w-96 bg-paper-2 border-r border-rule flex flex-col z-20 overflow-hidden select-none">
            {/* Left Header with Tabs */}
            <div className="h-14 border-b border-rule px-3 flex items-center justify-between shrink-0 bg-paper">
              <div className="flex items-center gap-[2px] bg-paper-3 p-[2px] rounded-control border border-rule text-xs">
                <button
                  onClick={() => setLeftTab('aoi')}
                  className={`h-[34px] px-2.5 flex items-center justify-center rounded-control font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus ${
                    leftTab === 'aoi'
                      ? 'bg-paper-surface text-ink border border-rule shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                      : 'text-muted hover:text-ink hover:bg-paper-surface/50 border border-transparent'
                  }`}
                >
                  Area
                </button>
                <button
                  onClick={() => setLeftTab('dataset')}
                  className={`h-[34px] px-2.5 flex items-center justify-center rounded-control font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus ${
                    leftTab === 'dataset'
                      ? 'bg-paper-surface text-ink border border-rule shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                      : 'text-muted hover:text-ink hover:bg-paper-surface/50 border border-transparent'
                  }`}
                >
                  Dataset
                </button>
                <button
                  onClick={() => setLeftTab('compare')}
                  className={`h-[34px] px-2.5 flex items-center justify-center rounded-control font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus ${
                    leftTab === 'compare'
                      ? 'bg-paper-surface text-ink border border-rule shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                      : 'text-muted hover:text-ink hover:bg-paper-surface/50 border border-transparent'
                  }`}
                >
                  Compare
                </button>
                <button
                  onClick={() => setLeftTab('layers')}
                  className={`h-[34px] px-2.5 flex items-center justify-center rounded-control font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus ${
                    leftTab === 'layers'
                      ? 'bg-paper-surface text-ink border border-rule shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                      : 'text-muted hover:text-ink hover:bg-paper-surface/50 border border-transparent'
                  }`}
                >
                  Phenomena
                </button>
                <button
                  onClick={() => setLeftTab('catalog')}
                  className={`h-[34px] px-2.5 flex items-center justify-center rounded-control font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus ${
                    leftTab === 'catalog'
                      ? 'bg-paper-surface text-ink border border-rule shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                      : 'text-muted hover:text-ink hover:bg-paper-surface/50 border border-transparent'
                  }`}
                >
                  Catalog
                </button>
              </div>

              <button
                onClick={() => setIsLeftCollapsed(true)}
                className="h-[34px] w-[34px] flex items-center justify-center rounded-control bg-paper-3 hover:bg-paper-surface text-muted hover:text-ink border border-rule transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus"
                title="Collapse control panel"
                aria-label="Collapse control panel"
              >
                <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
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

              {leftTab === 'dataset' && (
                <div className="space-y-4">
                  {uploadedDataset ? (
                    <DatasetSummary
                      dataset={uploadedDataset}
                      onOpenFieldMapper={() => setIsFieldMapperOpen(true)}
                      onClearDataset={handleClearDataset}
                      onEditRecord={handleEditRecord}
                      onAddPictures={handleAddPicturesToDataset}
                      onDeleteRecord={handleDeleteRecord}
                    />
                  ) : (
                    <DatasetUploader
                      onDatasetLoaded={handleDatasetLoaded}
                      currentDataset={uploadedDataset}
                      onClearDataset={handleClearDataset}
                    />
                  )}
                </div>
              )}

              {leftTab === 'compare' && (
                <DatasetCompareViewer
                  dataset={uploadedDataset}
                  selectedRecordA={selectedRecordA}
                  selectedRecordB={selectedRecordB}
                  onSelectRecordA={setSelectedRecordA}
                  onSelectRecordB={setSelectedRecordB}
                  compareMode={compareMode}
                  setCompareMode={setCompareMode}
                  swipePosition={swipePosition}
                  setSwipePosition={setSwipePosition}
                  onNavigateToUpload={() => setLeftTab('dataset')}
                  onEditRecord={handleEditRecord}
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
            </div>
          </aside>
        ) : (
          /* Collapsed Pill Button */
          <div className="absolute left-0 top-[88px] bottom-0 w-10 bg-paper-2 border-r border-rule flex flex-col items-center py-4 space-y-4 z-20">
            <button
              onClick={() => setIsLeftCollapsed(false)}
              className="h-[34px] w-[34px] flex items-center justify-center rounded-control bg-paper-3 hover:bg-paper-surface text-muted hover:text-ink border border-rule transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus"
              title="Expand control panel"
              aria-label="Expand control panel"
            >
              <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </button>
            <div className="writing-vertical text-muted text-xs font-medium rotate-180">
              Control panel
            </div>
          </div>
        )}

        {/* Central Map Canvas Area (Main Panel) */}
        <main className="flex-1 flex flex-col relative h-full overflow-hidden p-2 bg-paper-deep">
          <div className="flex-1 relative rounded-2xl overflow-hidden border border-rule/80 shadow-[0_0_40px_rgba(255,255,255,0.04)]">
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
              compareRecordA={selectedRecordA}
              compareRecordB={selectedRecordB}
              swipePosition={swipePosition}
              onSwipePositionChange={setSwipePosition}
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
      )}

      {/* Guidance & Architecture Info Modal */}
      <InfoModal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)} />

      {/* Dataset Field Mapper Modal */}
      {uploadedDataset && (
        <DatasetFieldMapper
          isOpen={isFieldMapperOpen}
          onClose={() => setIsFieldMapperOpen(false)}
          dataset={uploadedDataset}
          onApplyMapping={handleApplyFieldMapping}
        />
      )}

      {/* Picture & Observation Record Editor Modal */}
      <DatasetRecordEditorModal
        isOpen={isEditorModalOpen}
        onClose={() => setIsEditorModalOpen(false)}
        record={editingRecord}
        onSave={handleSaveRecord}
        onDelete={handleDeleteRecord}
      />
    </div>
  );
};

export default App;


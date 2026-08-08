'use client';

import { PresentationMode } from '@/components/presentation/PresentationMode';
import { DashboardHeader } from './DashboardHeader';
import { ExportDropdown } from './ExportDropdown';
import { FilterBar } from './FilterBar';
import { TierSection } from './TierSection';
import { EmptyState } from '@/components/shared/EmptyState';
import type { DashboardViewProps } from './dashboardShared';

export function StandardDashboardView(props: DashboardViewProps) {
  const {
    role,
    strategic,
    divisional,
    tactical,
    filteredAndSorted,
    objectives,
    scoreByObjectiveId,
    stats,
    filters,
    setFilters,
    divisions,
    presentationSlides,
    presentationActive,
    setPresentationActive,
    presentationIndex,
    setPresentationIndex,
    onExportPresentationPowerPoint,
    onExportPresentationGoogleSlides,
    myObjectivesCount,
    myWorkObjectives = [],
    viewPreferences,
    onExport,
    onExportGoogleSlides,
    exporting,
    exportingSlides,
  } = props;

  return (
    <div className="space-y-6">
      {presentationActive && presentationSlides.length > 0 && (
        <PresentationMode
          slides={presentationSlides}
          currentIndex={Math.min(presentationIndex, presentationSlides.length - 1)}
          onClose={() => {
            setPresentationActive(false);
            setPresentationIndex(0);
          }}
          onPrev={() => setPresentationIndex((i) => Math.max(0, i - 1))}
          onNext={() =>
            setPresentationIndex((i) => Math.min(presentationSlides.length - 1, i + 1))
          }
          onGoToSlide={setPresentationIndex}
          onExportPowerPoint={onExportPresentationPowerPoint}
          onExportGoogleSlides={onExportPresentationGoogleSlides}
        />
      )}
      <DashboardHeader
        role={role}
        totalObjectives={stats.totalObjectives}
        averageScore={stats.averageScore}
        onTrackPercent={stats.onTrackPercent}
        daysLeftInQuarter={stats.daysLeftInQuarter}
        myObjectivesCount={myObjectivesCount}
      />
      {myWorkObjectives.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold mb-3">My work</h2>
          <TierSection
            title="Objectives you own"
            objectives={myWorkObjectives}
            scoreByObjectiveId={scoreByObjectiveId}
            defaultExpanded
          />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <FilterBar
          filters={filters}
          onFiltersChange={setFilters}
          divisions={divisions}
          viewPreferences={viewPreferences}
        />
        <div className="flex flex-wrap items-center gap-2">
          {onExport && (
            <ExportDropdown
              onExport={onExport}
              onExportGoogleSlides={onExportGoogleSlides}
              onPresentationMode={() => {
                setPresentationIndex(0);
                setPresentationActive(true);
              }}
              exporting={exporting}
              exportingSlides={exportingSlides}
              disabled={filteredAndSorted.length === 0}
            />
          )}
        </div>
      </div>
      <div className="space-y-4">
        <TierSection
          title="Strategic (Annual)"
          objectives={strategic}
          scoreByObjectiveId={scoreByObjectiveId}
          defaultExpanded
        />
        <TierSection
          title="Divisional (Annual)"
          objectives={divisional}
          scoreByObjectiveId={scoreByObjectiveId}
          defaultExpanded
        />
        <TierSection
          title="Tactical (Quarterly)"
          objectives={tactical}
          scoreByObjectiveId={scoreByObjectiveId}
          defaultExpanded
        />
      </div>
      {filteredAndSorted.length === 0 && (
        <EmptyState
          icon={objectives.length === 0 ? 'target' : 'filter'}
          title={objectives.length === 0 ? 'No objectives yet' : 'No objectives match your filters'}
          description={
            objectives.length === 0
              ? 'Create your first objective to get started. Use the OKRs page to add strategic, divisional, or tactical objectives.'
              : 'Try changing or clearing filters to see more objectives.'
          }
          action={
            objectives.length === 0
              ? { label: 'Create objective', onClick: () => (window.location.href = '/okrs/new') }
              : undefined
          }
        />
      )}
    </div>
  );
}

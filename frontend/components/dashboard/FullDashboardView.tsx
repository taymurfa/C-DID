'use client';

import { PresentationMode, type ObjectiveSlide } from '@/components/presentation/PresentationMode';
import { PresentationChoiceDialog } from '@/components/presentation/PresentationChoiceDialog';
import { DashboardHeader } from './DashboardHeader';
import { ExportDropdown } from './ExportDropdown';
import { FilterBar } from './FilterBar';
import { TierSection } from './TierSection';
import { Button } from '@/components/ui/button';
import { UserMenu } from '@/components/UserMenu';
import { MobileSidebarMenuButton } from '@/components/MobileSidebarMenuButton';
import { ClipboardCheck, Users, Presentation } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/shared/EmptyState';
import type { DashboardViewProps } from './dashboardShared';

export function FullDashboardView(props: DashboardViewProps) {
  const {
    role,
    filteredAndSorted,
    objectives,
    scoreByObjectiveId,
    keyResultsByObjective,
    stats,
    filters,
    setFilters,
    divisions,
    departments,
    userNames,
    presentationSlides,
    presentationDeckStats,
    presentationActive,
    setPresentationActive,
    presentationIndex,
    setPresentationIndex,
    presentationChoiceOpen = false,
    onClosePresentationChoice,
    onSelectInfoOnly,
    onStartWithNarrative,
    generatePresentationStory,
    presentationNarrative = null,
    setPresentationNarrative,
    needsReviewObjectives = [],
    myWorkObjectives = [],
    onExportPresentationPowerPoint,
    onExportPresentationGoogleSlides,
    onPresentationMode,
    viewPreferences,
    onExport,
    onExportGoogleSlides,
    exporting,
    exportingSlides,
    currentUserName,
    dashboardTitle,
    dashboardSubtitle,
    hideEmptyStateCreate,
    showAdminUserManagement,
  } = props;

  /** Only explicit true — `role` can be preview-overridden and must not unlock admin links. */
  const showAdminUserManagementLink = showAdminUserManagement === true;

  const quarterLabel = `Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()}`;
  const headerTitle = dashboardTitle ?? 'OKR Dashboard';
  const headerSub =
    dashboardSubtitle ?? `${quarterLabel} • ${currentUserName ?? 'User'}`;

  return (
    <div className="min-h-full bg-muted/30">
      {presentationChoiceOpen && onSelectInfoOnly && onStartWithNarrative && generatePresentationStory && (
        <PresentationChoiceDialog
          open={presentationChoiceOpen}
          onClose={onClosePresentationChoice ?? (() => {})}
          objectiveIds={presentationSlides
            .filter((s): s is ObjectiveSlide => s.type === 'objective')
            .map((s) => s.objective._id)
            .filter((id): id is string => Boolean(id))}
          onInfoOnly={onSelectInfoOnly}
          onStartWithNarrative={onStartWithNarrative}
          generateStory={generatePresentationStory}
          disabled={presentationSlides.length === 0}
        />
      )}
      {presentationActive && presentationSlides.length > 0 && (
        <PresentationMode
          slides={presentationSlides}
          currentIndex={Math.min(presentationIndex, presentationSlides.length - 1)}
          onClose={() => {
            setPresentationActive(false);
          }}
          onPrev={() => setPresentationIndex((i) => Math.max(0, i - 1))}
          onNext={() =>
            setPresentationIndex((i) => Math.min(presentationSlides.length - 1, i + 1))
          }
          onGoToSlide={setPresentationIndex}
          onExportPowerPoint={onExportPresentationPowerPoint}
          onExportGoogleSlides={onExportPresentationGoogleSlides}
          narrative={presentationNarrative ?? undefined}
          departments={departments}
          userNames={userNames}
          deckStats={presentationDeckStats ?? null}
        />
      )}

      {/* Reference-style header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-2">
              <MobileSidebarMenuButton className="mt-0.5" />
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-foreground sm:text-2xl">{headerTitle}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{headerSub}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:max-w-[min(100%,28rem)] sm:justify-end">
              {showAdminUserManagementLink && (
                <Link
                  href="/admin/users"
                  className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground touch-manipulation"
                >
                  <Users className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">User management</span>
                  <span className="sm:hidden">Users</span>
                </Link>
              )}
              {onPresentationMode && (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="h-9 gap-1.5 touch-manipulation"
                  onClick={onPresentationMode}
                  disabled={filteredAndSorted.length === 0}
                  aria-label="Open presentation or slide view"
                >
                  <Presentation className="h-4 w-4 shrink-0" />
                  <span className="hidden min-[400px]:inline">Present / Slide view</span>
                  <span className="min-[400px]:hidden">Present</span>
                </Button>
              )}
              {onExport && (
                <ExportDropdown
                  onExport={onExport}
                  onExportGoogleSlides={onExportGoogleSlides}
                  onPresentationMode={onPresentationMode}
                  exporting={exporting}
                  exportingSlides={exportingSlides}
                  disabled={filteredAndSorted.length === 0}
                />
              )}
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 sm:py-6">
        <DashboardHeader
          variant="reference"
          role={role}
          totalObjectives={stats.totalObjectives}
          averageScore={stats.averageScore}
          onTrackPercent={stats.onTrackPercent}
          daysLeftInQuarter={stats.daysLeftInQuarter}
        />
        <FilterBar
          filters={filters}
          onFiltersChange={setFilters}
          divisions={divisions}
          departments={departments}
          viewPreferences={viewPreferences}
          variant="reference"
        />
        <div className="space-y-6 mt-6">
          {needsReviewObjectives.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20 p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-200 mb-3">
                <ClipboardCheck className="h-4 w-4" />
                Needs your review
              </h2>
              <TierSection
                title="Pending review"
                objectives={needsReviewObjectives}
                scoreByObjectiveId={scoreByObjectiveId}
                defaultExpanded
                variant="reference"
              />
            </div>
          )}
          {myWorkObjectives.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold text-foreground mb-3">My work</h2>
              <TierSection
                title="Objectives you own"
                objectives={myWorkObjectives}
                scoreByObjectiveId={scoreByObjectiveId}
                defaultExpanded
                variant="reference"
              />
            </div>
          )}
          <TierSection
            title="Objectives"
            objectives={filteredAndSorted}
            scoreByObjectiveId={scoreByObjectiveId}
            keyResultsByObjective={keyResultsByObjective}
            departments={departments}
            userNames={userNames}
            defaultExpanded
            variant="reference"
          />
        </div>
      {filteredAndSorted.length === 0 && (
        <EmptyState
          icon={objectives.length === 0 ? 'target' : 'filter'}
          title={objectives.length === 0 ? 'No objectives yet' : 'No objectives match your filters'}
          description={
            objectives.length === 0
              ? hideEmptyStateCreate
                ? 'Nothing is linked to you yet (ownership or key results). Browse the organization view to explore company OKRs, or ask an admin to assign your role and department.'
                : 'Create your first objective to get started. Use the OKRs page to add strategic, divisional, or tactical objectives.'
              : 'Try changing or clearing filters to see more objectives.'
          }
          action={
            objectives.length === 0 && !hideEmptyStateCreate
              ? { label: 'Create objective', onClick: () => (window.location.href = '/okrs/new') }
              : undefined
          }
          secondaryLink={
            objectives.length === 0 && hideEmptyStateCreate
              ? { label: 'Open organization view', href: '/divisions' }
              : undefined
          }
        />
      )}
      </div>
    </div>
  );
}

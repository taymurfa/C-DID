'use client';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, RotateCcw, Filter } from 'lucide-react';
import type { DashboardSortField, SortDirection } from '@/lib/api';

export interface DashboardFilters {
  search: string;
  tier: string;
  division: string;
  owner: string;
  status: string;
  scoreRange: string;
}

const defaultFilters: DashboardFilters = {
  search: '',
  tier: 'all',
  division: 'all',
  owner: '',
  status: 'all',
  scoreRange: 'all',
};

export interface ViewPreferencesBarProps {
  sort: DashboardSortField;
  sortDirection: SortDirection;
  onSortChange: (sort: DashboardSortField, direction: SortDirection) => void;
  filterUpdateType: string;
  onFilterUpdateTypeChange: (value: string) => void;
  onResetToDefault?: () => void;
}

interface FilterBarProps {
  filters: DashboardFilters;
  onFiltersChange: (f: DashboardFilters) => void;
  divisions: string[];
  /** When provided, department dropdown uses id/name; division filter uses these ids */
  departments?: { _id: string; name: string }[];
  /** When provided, show sort, update-type filter, and Reset to default (saved to profile) */
  viewPreferences?: ViewPreferencesBarProps;
  /** When true, only show search (e.g. view-only role) */
  minimal?: boolean;
  /** Reference design: white card with "Filter by:" label */
  variant?: 'default' | 'reference';
}

export function FilterBar({ filters, onFiltersChange, divisions, departments, viewPreferences, minimal, variant = 'default' }: FilterBarProps) {
  const set = (key: keyof DashboardFilters, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const isReference = variant === 'reference';
  const wrapperClass = isReference
    ? 'mb-6 rounded-lg border border-border bg-card p-4'
    : 'flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card/50 px-4 py-3';
  const departmentOptions = departments?.length ? departments : divisions.map((d) => ({ _id: d, name: d }));

  return (
    <div className={wrapperClass}>
      <div className={isReference ? 'flex flex-wrap items-center gap-4' : 'flex flex-wrap items-center gap-3'}>
        {isReference && (
          <div className="flex items-center gap-2 text-foreground">
            <Filter className="h-4 w-4" />
            <span className="text-sm font-medium">Filter by:</span>
          </div>
        )}
        <div className={`relative flex-1 min-w-[180px] ${isReference ? 'max-w-xs' : 'max-w-xs'}`}>
          <Search
            className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${isReference ? 'text-muted-foreground' : 'text-muted-foreground'}`}
          />
          <Input
            placeholder="Search objectives..."
            value={filters.search}
            onChange={(e) => set('search', e.target.value)}
            className={
              isReference
                ? 'w-full rounded-md border border-input bg-background py-2 pl-9 pr-4 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                : 'h-9 border-0 bg-muted/50 pl-9 focus-visible:ring-2'
            }
          />
        </div>
      {!minimal && (
        <>
          <div className="h-6 w-px bg-border" aria-hidden />
          <Input
            placeholder="Owner..."
            value={filters.owner}
            onChange={(e) => set('owner', e.target.value)}
            className={
              isReference
                ? 'h-9 w-[140px] border border-input bg-background pl-2 pr-3'
                : 'h-9 w-[140px] border-0 bg-muted/50 pl-2 pr-3'
            }
            aria-label="Filter by owner"
          />
          <Select value={filters.tier} onValueChange={(v) => set('tier', v)}>
            <SelectTrigger
              className={
                isReference
                  ? 'h-9 w-[120px] border border-input bg-background'
                  : 'h-9 w-[120px] border-0 bg-transparent shadow-none focus:ring-0'
              }
            >
              <SelectValue placeholder="Tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tiers</SelectItem>
              <SelectItem value="strategic">Strategic</SelectItem>
              <SelectItem value="functional">Functional</SelectItem>
              <SelectItem value="tactical">Tactical</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.division} onValueChange={(v) => set('division', v)}>
            <SelectTrigger
              className={
                isReference
                  ? 'h-9 w-[140px] border border-input bg-background'
                  : 'h-9 w-[130px] border-0 bg-transparent shadow-none focus:ring-0'
              }
            >
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departmentOptions.map((d) => (
                <SelectItem key={d._id} value={d._id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.status} onValueChange={(v) => set('status', v)}>
            <SelectTrigger
              className={
                isReference
                  ? 'h-9 w-[110px] border border-input bg-background'
                  : 'h-9 w-[110px] border-0 bg-transparent shadow-none focus:ring-0'
              }
            >
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="in_review">In Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.scoreRange} onValueChange={(v) => set('scoreRange', v)}>
            <SelectTrigger
              className={
                isReference
                  ? 'h-9 w-[120px] border border-input bg-background'
                  : 'h-9 w-[120px] border-0 bg-transparent shadow-none focus:ring-0'
              }
            >
              <SelectValue placeholder="Score" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Scores</SelectItem>
              <SelectItem value="on_track">On Track (70%+)</SelectItem>
              <SelectItem value="at_risk">At Risk (40–69%)</SelectItem>
              <SelectItem value="off_track">Off Track (&lt;40%)</SelectItem>
            </SelectContent>
          </Select>
          {viewPreferences && (
            <>
              <div className="h-6 w-px bg-border" aria-hidden />
              <Select
                value={`${viewPreferences.sort}-${viewPreferences.sortDirection}`}
                onValueChange={(v) => {
                  const [sort, dir] = v.split('-') as [DashboardSortField, SortDirection];
                  viewPreferences.onSortChange(sort, dir);
                }}
              >
                <SelectTrigger
                  className={
                    isReference
                      ? 'h-9 w-[130px] border border-input bg-background'
                      : 'h-9 w-[130px] border-0 bg-transparent shadow-none focus:ring-0'
                  }
                >
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="score-desc">Score (high first)</SelectItem>
                  <SelectItem value="score-asc">Score (low first)</SelectItem>
                  <SelectItem value="owner-asc">Owner (A–Z)</SelectItem>
                  <SelectItem value="owner-desc">Owner (Z–A)</SelectItem>
                  <SelectItem value="updated-desc">Updated (newest)</SelectItem>
                  <SelectItem value="updated-asc">Updated (oldest)</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={viewPreferences.filterUpdateType}
                onValueChange={viewPreferences.onFilterUpdateTypeChange}
              >
                <SelectTrigger
                  className={
                    isReference
                      ? 'h-9 w-[140px] border border-input bg-background'
                      : 'h-9 w-[140px] border-0 bg-transparent shadow-none focus:ring-0'
                  }
                >
                  <SelectValue placeholder="Update type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any activity</SelectItem>
                  <SelectItem value="recent">Updated last 7 days</SelectItem>
                </SelectContent>
              </Select>
              {viewPreferences.onResetToDefault && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={viewPreferences.onResetToDefault}
                  className="h-9 gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </Button>
              )}
            </>
          )}
        </>
      )}
      </div>
    </div>
  );
}

export { defaultFilters };

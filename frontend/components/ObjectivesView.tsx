'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { 
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  Users,
  Building2,
  RefreshCw,
  Edit,
  Target
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { api, Objective as ApiObjective, KeyResult as ApiKeyResult, ObjectiveTree } from '@/lib/api';

interface KeyResult {
  id: string;
  title: string;
  target: number;
  unit: string;
  currentValue: number;
  score: number;
  notes: string;
}

interface Objective {
  id: string;
  title: string;
  description: string;
  level: 'strategic' | 'functional' | 'tactical';
  timeline: 'annual' | 'quarterly';
  fiscalYear: number;
  quarter?: number;
  division?: string;
  owner: string;
  progress: number;
  keyResults: KeyResult[];
  children?: Objective[];
}

// Helper to convert API data to component format
function convertToObjectiveTree(apiObj: ObjectiveTree, allObjectives: ApiObjective[]): Objective {
  const krs = (apiObj.keyResults || []).map(kr => ({
    id: kr._id || '',
    title: kr.title,
    target: parseFloat(kr.target || '0'),
    unit: kr.unit || '',
    currentValue: parseFloat(kr.currentValue || '0'),
    score: kr.score || 0,
    notes: kr.notes?.[0]?.text || ''
  }));

  const progress = krs.length > 0
    ? Math.round(krs.reduce((sum, kr) => sum + kr.score, 0) / krs.length)
    : 0;

  return {
    id: apiObj._id || '',
    title: apiObj.title,
    description: apiObj.description || '',
    level: apiObj.level,
    timeline: apiObj.timeline,
    fiscalYear: apiObj.fiscalYear,
    quarter: apiObj.quarter ? parseInt(apiObj.quarter) : undefined,
    division: apiObj.division,
    owner: apiObj.ownerId || 'Unknown',
    progress,
    keyResults: krs,
    children: (apiObj.children || []).map(child => convertToObjectiveTree(child, allObjectives))
  };
}


interface ObjectivesViewProps {
  prefetchedApiObjectives?: ApiObjective[];
  hideFilters?: boolean;
}

const ROOT_PAGE_SIZE = 6;

function ObjectivesTreeSkeleton() {
  return (
    <div className="space-y-3 animate-pulse" aria-hidden="true">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
          <div className="h-5 bg-muted rounded w-2/3" />
          <div className="h-3 bg-muted rounded w-full" />
          <div className="h-3 bg-muted rounded w-4/5" />
          <div className="h-2 bg-muted rounded w-full mt-4" />
        </div>
      ))}
    </div>
  );
}

export function ObjectivesView({ prefetchedApiObjectives, hideFilters }: ObjectivesViewProps) {
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [rootPage, setRootPage] = useState(1);

  const filteredRoots = useMemo(() => {
    let list = objectives;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (o) =>
          o.title.toLowerCase().includes(q) ||
          o.description.toLowerCase().includes(q) ||
          o.owner.toLowerCase().includes(q)
      );
    }
    if (levelFilter !== 'all') {
      list = list.filter((o) => o.level === levelFilter);
    }
    if (statusFilter !== 'all') {
      list = list.filter((o) => {
        if (statusFilter === 'on-track') return o.progress >= 80;
        if (statusFilter === 'at-risk') return o.progress >= 60 && o.progress < 80;
        if (statusFilter === 'behind') return o.progress < 60;
        return true;
      });
    }
    return list;
  }, [objectives, searchQuery, levelFilter, statusFilter]);

  const rootTotalPages = Math.max(1, Math.ceil(filteredRoots.length / ROOT_PAGE_SIZE));
  const pagedRoots = useMemo(() => {
    const start = (rootPage - 1) * ROOT_PAGE_SIZE;
    return filteredRoots.slice(start, start + ROOT_PAGE_SIZE);
  }, [filteredRoots, rootPage]);

  useEffect(() => {
    setRootPage(1);
  }, [searchQuery, levelFilter, statusFilter]);

  useEffect(() => {
    if (rootPage > rootTotalPages) setRootPage(rootTotalPages);
  }, [rootPage, rootTotalPages]);

  useEffect(() => {
    loadData(prefetchedApiObjectives);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefetchedApiObjectives]);

  const loadData = async (apiObjectivesOverride?: ApiObjective[]) => {
    try {
      const allObjs = apiObjectivesOverride ?? (await api.getObjectives({}));

      // Roots: no parent, or parent id not in this list (broken / cross-store link after migration)
      const idSet = new Set(allObjs.map((o) => String(o._id)).filter(Boolean));
      const rootObjs = allObjs.filter((o) => {
        const p = o.parentObjectiveId;
        if (p == null || p === '') return true;
        return !idSet.has(String(p));
      });
      const rootsToFetch = rootObjs.length > 0 ? rootObjs : allObjs;

      // Build tree structure by fetching full tree for each root
      const rootTrees = await Promise.all(rootsToFetch.map(async (obj) => {
        if (!obj._id) return null;
        try {
          const tree = await api.getObjectiveTree(obj._id);
          return convertToObjectiveTree(tree, allObjs);
        } catch {
          return null;
        }
      }));

      const validTrees = rootTrees.filter((t): t is Objective => t !== null);
      setObjectives(validTrees);
      if (validTrees.length > 0) {
        setExpandedNodes(new Set([validTrees[0].id]));
      }
    } catch (error) {
      console.error('Error loading objectives:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleNode = (id: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedNodes(newExpanded);
  };

  const getLevelBadgeVariant = (level: string): "default" | "secondary" | "outline" => {
    switch (level) {
      case 'strategic': return 'default';
      case 'functional': return 'secondary';
      case 'tactical': return 'outline';
      default: return 'default';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const renderObjectiveTree = (objective: Objective, depth: number = 0) => {
    const isExpanded = expandedNodes.has(objective.id);
    const hasChildren = objective.children && objective.children.length > 0;

    return (
      <div key={objective.id} className="mb-3">
        <Card className={`${depth > 0 ? 'ml-8' : ''} hover:shadow-md transition-shadow`}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-11 w-11 min-h-[44px] min-w-[44px] p-0 mt-0 touch-manipulation shrink-0"
                  onClick={() => toggleNode(objective.id)}
                  disabled={!hasChildren}
                  aria-label={hasChildren ? (isExpanded ? 'Collapse' : 'Expand') : 'No children'}
                >
                  {hasChildren ? (
                    isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                  ) : (
                    <Target className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Badge variant={getLevelBadgeVariant(objective.level)} className="capitalize">
                      {objective.level}
                    </Badge>
                    <Badge variant="outline">
                      {objective.timeline === 'annual' ? objective.fiscalYear : `Q${objective.quarter} ${objective.fiscalYear}`}
                    </Badge>
                    {objective.division && (
                      <Badge variant="outline">
                        <Building2 className="h-3 w-3 mr-1" />
                        {objective.division}
                      </Badge>
                    )}
                    <Badge 
                      variant="outline" 
                      className={objective.progress >= 80 ? 'border-green-500 text-green-700' : 
                                 objective.progress >= 60 ? 'border-yellow-500 text-yellow-700' : 
                                 'border-red-500 text-red-700'}
                    >
                      {objective.progress >= 80 ? 'On Track' : objective.progress >= 60 ? 'At Risk' : 'Behind'}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg mb-1">{objective.title}</CardTitle>
                  <CardDescription>{objective.description}</CardDescription>
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{objective.owner}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                {objective.id ? (
                  <>
                    <Button variant="ghost" size="sm" className="min-h-[44px] min-w-[44px] touch-manipulation" asChild>
                      <Link
                        href={`/okrs/${objective.id}?tab=progress`}
                        title="Update progress"
                        aria-label="Update progress"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button variant="ghost" size="sm" className="min-h-[44px] min-w-[44px] touch-manipulation" asChild>
                      <Link
                        href={`/okrs/${objective.id}`}
                        title="Open objective details"
                        aria-label="Open objective details"
                      >
                        <Edit className="h-4 w-4" />
                      </Link>
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" size="sm" className="min-h-[44px] min-w-[44px] touch-manipulation" disabled title="Objective id missing" aria-label="Update progress unavailable">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="min-h-[44px] min-w-[44px] touch-manipulation" disabled title="Objective id missing" aria-label="View objective unavailable">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Overall Progress</span>
                  <span className={`text-sm font-bold ${getScoreColor(objective.progress)}`}>
                    {objective.progress}%
                  </span>
                </div>
                <Progress value={objective.progress} className="h-2" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Key Results ({objective.keyResults.length})</span>
                </div>
                {objective.keyResults.map((kr) => (
                  <div key={kr.id} className="p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-sm font-medium flex-1">{kr.title}</span>
                      <span className={`text-sm font-bold ml-2 ${getScoreColor(kr.score)}`}>
                        {kr.score}%
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                      <span>Current: {kr.currentValue} {kr.unit}</span>
                      <span>Target: {kr.target} {kr.unit}</span>
                    </div>
                    <Progress value={(kr.currentValue / kr.target) * 100} className="h-1 mb-2" />
                    {kr.notes && (
                      <p className="text-xs text-muted-foreground italic">{kr.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {isExpanded && hasChildren && (
          <div className="mt-3">
            {objective.children?.map(child => renderObjectiveTree(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {!hideFilters && (
        <Card>
          <CardHeader>
            <CardTitle>All Objectives</CardTitle>
            <CardDescription>Hierarchical view of strategic, functional, and tactical objectives</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search objectives..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2">
                <Select value={levelFilter} onValueChange={setLevelFilter}>
                  <SelectTrigger className="w-[160px]">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="strategic">Strategic</SelectItem>
                    <SelectItem value="functional">Functional</SelectItem>
                    <SelectItem value="tactical">Tactical</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="on-track">On Track</SelectItem>
                    <SelectItem value="at-risk">At Risk</SelectItem>
                    <SelectItem value="behind">Behind</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Objectives Tree */}
      {loading ? (
        <div className="space-y-2">
          <p className="sr-only" aria-live="polite">
            Loading objectives…
          </p>
          <ObjectivesTreeSkeleton />
        </div>
      ) : objectives.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No objectives found. Create one with "New Objective" button.
          </CardContent>
        </Card>
      ) : filteredRoots.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No objectives match your filters. Try clearing search or filters.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {pagedRoots.map((obj) => renderObjectiveTree(obj))}
          </div>
          {filteredRoots.length > ROOT_PAGE_SIZE && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t">
              <p className="text-sm text-muted-foreground">
                Page {rootPage} of {rootTotalPages} · {filteredRoots.length} root objective
                {filteredRoots.length !== 1 ? 's' : ''}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-[44px] touch-manipulation"
                  disabled={rootPage <= 1}
                  onClick={() => setRootPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-[44px] touch-manipulation"
                  disabled={rootPage >= rootTotalPages}
                  onClick={() => setRootPage((p) => Math.min(rootTotalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

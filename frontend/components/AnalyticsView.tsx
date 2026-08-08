'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Target,
  BarChart3,
  Award,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { api, Objective, KeyResult } from '@/lib/api';
import { ChartAccessible } from '@/components/shared/ChartAccessible';

/** API uses 0–1 OKR-style scores; thresholds match dashboard conventions. */
function score01(kr: KeyResult): number {
  const s = kr.score;
  if (s == null || Number.isNaN(s)) return 0;
  return Math.min(1, Math.max(0, s));
}

function scoreToStatus(score: number): 'on-track' | 'at-risk' | 'behind' | 'completed' {
  if (score >= 1) return 'completed';
  if (score >= 0.8) return 'on-track';
  if (score >= 0.6) return 'at-risk';
  return 'behind';
}

function scoreBucketIndex(s: number): number {
  if (s >= 1) return 4;
  return Math.min(4, Math.floor(s * 5));
}

const KR_BUCKET_LABELS = ['0–20%', '20–40%', '40–60%', '60–80%', '80–100%'];

interface KeyResultStatus {
  id: string;
  title: string;
  objective: string;
  level: string;
  /** 0–1 */
  score01: number;
  target: number;
  current: number;
  unit: string;
  status: 'on-track' | 'at-risk' | 'behind' | 'completed';
}

function progressBarPercent(kr: KeyResultStatus): number {
  const s = kr.score01;
  if (s > 0) return Math.min(100, Math.round(s * 100));
  const t = kr.target;
  if (t > 0 && Number.isFinite(kr.current)) return Math.min(100, Math.round((kr.current / t) * 100));
  return 0;
}

export function AnalyticsView() {
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [keyResults, setKeyResults] = useState<KeyResult[]>([]);
  const [loading, setLoading] = useState(true);
  const fiscalYear = new Date().getFullYear();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const objs = await api.getObjectives({ fiscalYear });
      setObjectives(objs);

      const lists = await Promise.all(
        objs
          .filter((o): o is Objective & { _id: string } => Boolean(o._id))
          .map((o) => api.getKeyResults(o._id).catch(() => [] as KeyResult[]))
      );
      setKeyResults(lists.flat());
    } catch (error) {
      console.error('Error loading analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const keyResultsStatus: KeyResultStatus[] = useMemo(() => {
    return keyResults.map((kr) => {
      const obj = objectives.find((o) => o._id === kr.objectiveId);
      const s = score01(kr);
      const target = parseFloat(String(kr.target ?? '0')) || 0;
      const current = parseFloat(String(kr.currentValue ?? '0')) || 0;
      return {
        id: kr._id || '',
        title: kr.title,
        objective: obj?.title || 'Unknown',
        level: obj?.level || 'unknown',
        score01: s,
        target,
        current,
        unit: kr.unit || '',
        status: scoreToStatus(s),
      };
    });
  }, [keyResults, objectives]);

  const objectivesByLevelData = useMemo(() => {
    let strategic = 0;
    let functional = 0;
    let tactical = 0;
    objectives.forEach((o) => {
      switch (o.level) {
        case 'strategic':
          strategic++;
          break;
        case 'functional':
          functional++;
          break;
        case 'tactical':
          tactical++;
          break;
        default:
          break;
      }
    });
    return [
      { name: 'Strategic', count: strategic },
      { name: 'Functional', count: functional },
      { name: 'Tactical', count: tactical },
    ];
  }, [objectives]);

  const objectivesByStatusData = useMemo(() => {
    const m = { draft: 0, in_review: 0, approved: 0, rejected: 0, other: 0 };
    objectives.forEach((o) => {
      const st = (o.status ?? 'draft').toString().toLowerCase();
      if (st === 'draft') m.draft++;
      else if (st === 'in_review') m.in_review++;
      else if (st === 'approved') m.approved++;
      else if (st === 'rejected') m.rejected++;
      else m.other++;
    });
    return [
      { name: 'Draft', count: m.draft },
      { name: 'In review', count: m.in_review },
      { name: 'Approved', count: m.approved },
      { name: 'Rejected', count: m.rejected },
      ...(m.other > 0 ? [{ name: 'Other', count: m.other }] : []),
    ];
  }, [objectives]);

  const krScoreHistogramData = useMemo(() => {
    const hist = [0, 0, 0, 0, 0];
    keyResults.forEach((kr) => {
      hist[scoreBucketIndex(score01(kr))]++;
    });
    return KR_BUCKET_LABELS.map((range, i) => ({ range, count: hist[i] }));
  }, [keyResults]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'on-track':
        return <TrendingUp className="h-5 w-5 text-green-600" />;
      case 'at-risk':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'behind':
        return <TrendingDown className="h-5 w-5 text-red-600" />;
      default:
        return <Target className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      completed: 'bg-green-100 text-green-800 border-green-200',
      'on-track': 'bg-green-100 text-green-800 border-green-200',
      'at-risk': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      behind: 'bg-red-100 text-red-800 border-red-200',
    };
    return styles[status as keyof typeof styles] || styles['on-track'];
  };

  const getLevelBadgeVariant = (level: string): 'default' | 'secondary' | 'outline' => {
    switch (level) {
      case 'strategic':
        return 'default';
      case 'functional':
        return 'secondary';
      case 'tactical':
        return 'outline';
      default:
        return 'default';
    }
  };

  const completedKRs = keyResultsStatus.filter((kr) => kr.status === 'completed').length;
  const onTrackKRs = keyResultsStatus.filter((kr) => kr.status === 'on-track').length;
  const atRiskKRs = keyResultsStatus.filter((kr) => kr.status === 'at-risk').length;
  const behindKRs = keyResultsStatus.filter((kr) => kr.status === 'behind').length;
  const totalKRs = keyResultsStatus.length;
  const avgScorePercent =
    totalKRs > 0
      ? Math.round(
          (keyResultsStatus.reduce((sum, kr) => sum + kr.score01, 0) / totalKRs) * 100
        )
      : 0;

  const pct = (n: number) => (totalKRs > 0 ? Math.round((n / totalKRs) * 100) : 0);

  if (loading) {
    return <div className="text-center text-muted-foreground">Loading...</div>;
  }

  const levelSummary = objectivesByLevelData.map((d) => `${d.name}: ${d.count}`).join('; ');
  const statusSummary = objectivesByStatusData.map((d) => `${d.name}: ${d.count}`).join('; ');
  const histSummary = krScoreHistogramData.map((d) => `${d.range} ${d.count} KRs`).join('; ');

  const renderKeyResultsList = (filteredKRs: KeyResultStatus[]) => (
    <div className="space-y-3">
      {filteredKRs.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No key results found</p>
      ) : (
        filteredKRs.map((kr) => {
          const pctScore = Math.round(kr.score01 * 100);
          return (
            <Card key={kr.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusIcon(kr.status)}
                      <Badge className={getStatusBadge(kr.status)}>{kr.status.replace('-', ' ')}</Badge>
                      <Badge variant={getLevelBadgeVariant(kr.level)}>{kr.level}</Badge>
                    </div>
                    <CardTitle className="text-base">{kr.title}</CardTitle>
                    <CardDescription className="mt-1">{kr.objective}</CardDescription>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-2xl font-bold">{pctScore}%</div>
                    <div className="text-xs text-muted-foreground">Score</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">
                      {kr.current} / {kr.target}
                      {kr.unit ? ` ${kr.unit}` : ''}
                    </span>
                  </div>
                  <Progress value={progressBarPercent(kr)} className="h-2" />
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );

  const topPerformers = [...keyResultsStatus]
    .filter((kr) => kr.score01 >= 0.8)
    .sort((a, b) => b.score01 - a.score01);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Objectives ({fiscalYear})</CardDescription>
            <CardTitle className="text-3xl">{objectives.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Target className="h-4 w-4" />
              <span>In scope for this fiscal year</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total KRs</CardDescription>
            <CardTitle className="text-3xl">{totalKRs}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              <span>{avgScorePercent}% avg score</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-3">
            <CardDescription>Completed</CardDescription>
            <CardTitle className="text-3xl text-green-700">{completedKRs}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span>{pct(completedKRs)}%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <CardDescription>On track</CardDescription>
            <CardTitle className="text-3xl text-blue-700">{onTrackKRs}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <TrendingUp className="h-4 w-4" />
              <span>{pct(onTrackKRs)}%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="pb-3">
            <CardDescription>At risk</CardDescription>
            <CardTitle className="text-3xl text-yellow-700">{atRiskKRs}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-yellow-600">
              <AlertTriangle className="h-4 w-4" />
              <span>{pct(atRiskKRs)}%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-3">
            <CardDescription>Behind</CardDescription>
            <CardTitle className="text-3xl text-red-700">{behindKRs}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-red-600">
              <TrendingDown className="h-4 w-4" />
              <span>{pct(behindKRs)}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Objectives by level</CardTitle>
            <CardDescription>Count of objectives in this fiscal year by tier</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartAccessible summary={`Bar chart — objectives by level: ${levelSummary}.`}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={objectivesByLevelData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#6366f1" name="Objectives" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartAccessible>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Objectives by status</CardTitle>
            <CardDescription>Workflow state for objectives in this fiscal year</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartAccessible summary={`Bar chart — objectives by status: ${statusSummary}.`}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={objectivesByStatusData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0ea5e9" name="Objectives" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartAccessible>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Key result score distribution</CardTitle>
          <CardDescription>
            How many key results fall in each score band (0–1 scale → percentage bands)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartAccessible summary={`Histogram of KR scores: ${histSummary}.`}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={krScoreHistogramData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="range" className="text-xs" />
                <YAxis className="text-xs" allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#22c55e" name="Key results" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartAccessible>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key results — detail</CardTitle>
          <CardDescription>All key results loaded from your objectives ({fiscalYear})</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="space-y-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="all">All ({totalKRs})</TabsTrigger>
              <TabsTrigger value="completed">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Done ({completedKRs})
              </TabsTrigger>
              <TabsTrigger value="on-track">
                <TrendingUp className="h-4 w-4 mr-2" />
                On track ({onTrackKRs})
              </TabsTrigger>
              <TabsTrigger value="at-risk">
                <AlertTriangle className="h-4 w-4 mr-2" />
                At risk ({atRiskKRs})
              </TabsTrigger>
              <TabsTrigger value="behind">
                <TrendingDown className="h-4 w-4 mr-2" />
                Behind ({behindKRs})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              {renderKeyResultsList(keyResultsStatus)}
            </TabsContent>

            <TabsContent value="completed" className="space-y-4">
              {renderKeyResultsList(keyResultsStatus.filter((kr) => kr.status === 'completed'))}
            </TabsContent>

            <TabsContent value="on-track" className="space-y-4">
              {renderKeyResultsList(keyResultsStatus.filter((kr) => kr.status === 'on-track'))}
            </TabsContent>

            <TabsContent value="at-risk" className="space-y-4">
              {renderKeyResultsList(keyResultsStatus.filter((kr) => kr.status === 'at-risk'))}
            </TabsContent>

            <TabsContent value="behind" className="space-y-4">
              {renderKeyResultsList(keyResultsStatus.filter((kr) => kr.status === 'behind'))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-600" />
            Strongest key results
          </CardTitle>
          <CardDescription>Key results at or above 80% score (0.8 on the 0–1 scale)</CardDescription>
        </CardHeader>
        <CardContent>
          {topPerformers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No key results at 80% or above yet.</p>
          ) : (
            <div className="space-y-3">
              {topPerformers.map((kr) => {
                const pctScore = Math.round(kr.score01 * 100);
                return (
                  <div
                    key={kr.id}
                    className="flex items-center justify-between border-l-4 border-l-green-500 bg-green-50 p-4 rounded-r-lg dark:bg-green-950/30"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{kr.title}</p>
                      <p className="text-sm text-muted-foreground">{kr.objective}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="outline" className="border-green-500 text-green-700 dark:text-green-400">
                        <Award className="h-3 w-3 mr-1" />
                        {kr.score01 >= 1 ? 'Complete' : 'Strong'}
                      </Badge>
                      <span className="text-lg font-bold text-green-600">{pctScore}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

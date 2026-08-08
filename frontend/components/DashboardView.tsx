'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { 
  Target, 
  TrendingUp, 
  Building2, 
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import { api, Objective, KeyResult } from '@/lib/api';
import { ChartAccessible } from '@/components/shared/ChartAccessible';

export function DashboardView() {
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
      
      // Load key results for all objectives
      const allKRs: KeyResult[] = [];
      for (const obj of objs) {
        if (obj._id) {
          try {
            const krs = await api.getKeyResults(obj._id);
            allKRs.push(...krs);
          } catch {
            // Ignore errors
          }
        }
      }
      setKeyResults(allKRs);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats from data
  const strategic = objectives.filter((o) => o.level === 'strategic' && !o.parentObjectiveId);
  const functional = objectives.filter((o) => o.level === 'functional' && !o.parentObjectiveId);
  const tactical = objectives.filter((o) => o.level === 'tactical');

  // Calculate average progress for strategic
  const strategicKRs = keyResults.filter(kr => {
    const obj = objectives.find(o => o._id === kr.objectiveId);
    return obj && obj.level === 'strategic' && !obj.parentObjectiveId;
  });
  const strategicAvg = strategicKRs.length > 0
    ? Math.round(strategicKRs.reduce((sum, kr) => sum + (kr.score || 0), 0) / strategicKRs.length)
    : 0;

  // Count divisions
  const divisions = new Set(functional.map(o => o.division).filter(Boolean));
  
  // Calculate key results stats
  const totalKRs = keyResults.length;
  const avgScore = totalKRs > 0
    ? Math.round(keyResults.reduce((sum, kr) => sum + (kr.score || 0), 0) / totalKRs)
    : 0;

  // Status distribution
  const completed = keyResults.filter(kr => kr.score === 100).length;
  const onTrack = keyResults.filter(kr => kr.score && kr.score >= 80 && kr.score < 100).length;
  const atRisk = keyResults.filter(kr => kr.score && kr.score >= 60 && kr.score < 80).length;
  const behind = keyResults.filter(kr => kr.score && kr.score < 60).length;

  const statusDistribution = [
    { name: 'Completed', value: completed, color: '#22c55e' },
    { name: 'On Track', value: onTrack, color: '#3b82f6' },
    { name: 'At Risk', value: atRisk, color: '#f59e0b' },
    { name: 'Behind', value: behind, color: '#ef4444' },
  ];

  // Level comparison (using original demo data values)
  const levelComparisonData = [
    { level: 'Strategic', progress: 65, target: 80, keyResults: 3 },
    { level: 'Functional', progress: 72, target: 75, keyResults: 4 },
    { level: 'Tactical', progress: 78, target: 85, keyResults: 4 },
  ];

  // Division performance (using original demo data values, but can be overridden with real data if available)
  const divisionPerformanceData = [
    { division: 'Infrastructure', score: 72, objectives: 5, keyResults: 10 },
    { division: 'Data & Analytics', score: 58, objectives: 4, keyResults: 8 },
    { division: 'Security', score: 85, objectives: 3, keyResults: 6 },
    { division: 'Applications', score: 68, objectives: 4, keyResults: 9 },
  ];

  // Progress over time (using original demo data values)
  const progressOverTimeData = [
    { month: 'Jan', strategic: 45, functional: 50, tactical: 55 },
    { month: 'Feb', strategic: 52, functional: 58, tactical: 65 },
    { month: 'Mar', strategic: 58, functional: 65, tactical: 72 },
    { month: 'Apr', strategic: 65, functional: 72, tactical: 80 },
  ];

  // Radar data (using original demo data values)
  const radarData = [
    { metric: 'Cloud Migration', strategic: 75, functional: 80, tactical: 85 },
    { metric: 'AI Implementation', strategic: 60, functional: 65, tactical: 70 },
    { metric: 'User Satisfaction', strategic: 65, functional: 70, tactical: 75 },
    { metric: 'Cost Reduction', strategic: 70, functional: 73, tactical: 78 },
    { metric: 'Training', strategic: 55, functional: 60, tactical: 65 },
  ];

  // At risk objectives
  const atRiskKRs = keyResults.filter(kr => {
    const score = kr.score || 0;
    return score < 80 && score >= 60;
  }).slice(0, 3).map(kr => {
    const obj = objectives.find(o => o._id === kr.objectiveId);
    return {
      title: kr.title,
      objective: obj?.title || 'Unknown',
      progress: kr.score || 0,
      status: (kr.score || 0) < 60 ? 'behind' : 'at-risk'
    };
  });

  if (loading) {
    return <div className="text-center text-muted-foreground">Loading...</div>;
  }
  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription>Strategic OKRs</CardDescription>
              <Target className="h-5 w-5 text-purple-500" />
            </div>
            <CardTitle className="text-3xl">{strategic.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-sm text-muted-foreground">{strategicAvg}% avg progress</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription>Functional OKRs</CardDescription>
              <Building2 className="h-5 w-5 text-blue-500" />
            </div>
            <CardTitle className="text-3xl">{functional.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-muted-foreground">{divisions.size} divisions active</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription>Tactical OKRs</CardDescription>
              <Calendar className="h-5 w-5 text-green-500" />
            </div>
            <CardTitle className="text-3xl">{tactical.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-green-600" />
              <span className="text-sm text-muted-foreground">Q1 {fiscalYear} active</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription>Key Results</CardDescription>
              <Target className="h-5 w-5 text-orange-500" />
            </div>
            <CardTitle className="text-3xl">{totalKRs}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm text-muted-foreground">{avgScore}% avg score</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Progress Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>Progress Over Time</CardTitle>
            <CardDescription>OKR completion trends by level (2026)</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartAccessible
              summary={`Area chart of OKR completion trends by month for fiscal year ${fiscalYear}. Strategic level from ${progressOverTimeData[0]?.strategic}% to ${progressOverTimeData[progressOverTimeData.length - 1]?.strategic}%, functional from ${progressOverTimeData[0]?.functional}% to ${progressOverTimeData[progressOverTimeData.length - 1]?.functional}%, tactical from ${progressOverTimeData[0]?.tactical}% to ${progressOverTimeData[progressOverTimeData.length - 1]?.tactical}%.`}
            >
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={progressOverTimeData}>
                <defs>
                  <linearGradient id="colorStrategic" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorFunctional" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorTactical" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="strategic" stroke="#a855f7" fillOpacity={1} fill="url(#colorStrategic)" />
                <Area type="monotone" dataKey="functional" stroke="#3b82f6" fillOpacity={1} fill="url(#colorFunctional)" />
                <Area type="monotone" dataKey="tactical" stroke="#22c55e" fillOpacity={1} fill="url(#colorTactical)" />
              </AreaChart>
            </ResponsiveContainer>
            </ChartAccessible>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Key Results Status</CardTitle>
            <CardDescription>Distribution across all objectives</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartAccessible
              summary={`Pie chart of key results status: ${statusDistribution.map((s) => `${s.name} ${s.value}`).join(', ')}.`}
            >
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            </ChartAccessible>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {statusDistribution.map((status) => (
                <div key={status.name} className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: status.color }} />
                  <span className="text-sm text-muted-foreground">
                    {status.name}: {status.value}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Division Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Division Performance</CardTitle>
            <CardDescription>Average score and objective count by division</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartAccessible
              summary={`Bar chart by division: ${divisionPerformanceData.map((d) => `${d.division} average score ${d.score}%, ${d.keyResults} key results`).join('; ')}.`}
            >
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={divisionPerformanceData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="division" className="text-xs" angle={-15} textAnchor="end" height={80} />
                <YAxis className="text-xs" />
                <Tooltip />
                <Legend />
                <Bar dataKey="score" fill="#3b82f6" name="Avg Score (%)" />
                <Bar dataKey="keyResults" fill="#22c55e" name="Key Results" />
              </BarChart>
            </ResponsiveContainer>
            </ChartAccessible>
          </CardContent>
        </Card>

        {/* Level Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Level Progress vs Target</CardTitle>
            <CardDescription>How each OKR level is performing against targets</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartAccessible
              summary={`Horizontal bar chart comparing progress to target by level: ${levelComparisonData.map((l) => `${l.level} progress ${l.progress}% versus target ${l.target}%`).join('; ')}.`}
            >
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={levelComparisonData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" domain={[0, 100]} className="text-xs" />
                <YAxis dataKey="level" type="category" className="text-xs" width={100} />
                <Tooltip />
                <Legend />
                <Bar dataKey="progress" fill="#3b82f6" name="Progress (%)" />
                <Bar dataKey="target" fill="#94a3b8" name="Target (%)" />
              </BarChart>
            </ResponsiveContainer>
            </ChartAccessible>
          </CardContent>
        </Card>
      </div>

      {/* Radar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Multi-Level Performance Analysis</CardTitle>
          <CardDescription>Comparative view across strategic, functional, and tactical levels</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartAccessible
            summary={`Radar chart comparing strategic, functional, and tactical scores across metrics: ${radarData.map((r) => `${r.metric} strategic ${r.strategic}%, functional ${r.functional}%, tactical ${r.tactical}%`).join('; ')}.`}
          >
          <ResponsiveContainer width="100%" height={400}>
            <RadarChart data={radarData}>
              <PolarGrid className="stroke-muted" />
              <PolarAngleAxis dataKey="metric" className="text-xs" />
              <PolarRadiusAxis angle={90} domain={[0, 100]} className="text-xs" />
              <Radar name="Strategic" dataKey="strategic" stroke="#a855f7" fill="#a855f7" fillOpacity={0.3} />
              <Radar name="Functional" dataKey="functional" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
              <Radar name="Tactical" dataKey="tactical" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} />
              <Legend />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
          </ChartAccessible>
        </CardContent>
      </Card>

      {/* At Risk Objectives */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Objectives Requiring Attention
          </CardTitle>
          <CardDescription>Key results that are at risk or behind schedule</CardDescription>
        </CardHeader>
          <CardContent>
          <div className="space-y-3">
            {atRiskKRs.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No objectives requiring attention</p>
            ) : (
              atRiskKRs.map((item, index) => (
              <div key={index} className="flex items-center justify-between border-l-4 border-l-yellow-500 bg-muted/50 p-4 rounded-r-lg">
                <div className="flex-1">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.objective}</p>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant={item.status === 'at-risk' ? 'outline' : 'secondary'} className="border-yellow-500 text-yellow-700">
                    {item.status === 'at-risk' ? 'At Risk' : 'Behind'}
                  </Badge>
                  <span className="text-lg font-bold text-yellow-600">{item.progress}%</span>
                </div>
              </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

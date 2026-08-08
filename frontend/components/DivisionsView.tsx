'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Building2, Users, Target, TrendingUp, AlertCircle } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar
} from 'recharts';
import { api, Objective, KeyResult } from '@/lib/api';
import { ChartAccessible } from '@/components/shared/ChartAccessible';

const divisionColors: Record<string, string> = {
  'Infrastructure': '#3b82f6',
  'Data & Analytics': '#8b5cf6',
  'Security': '#22c55e',
  'Applications': '#f59e0b',
};

export function DivisionsView() {
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
      console.error('Error loading divisions data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Group by division
  const divisions = new Set(objectives.map(o => o.division).filter(Boolean));
  const divisionsData = Array.from(divisions).map(div => {
    const divObjs = objectives.filter(o => o.division === div);
    const divKRs = keyResults.filter(kr => {
      const obj = objectives.find(o => o._id === kr.objectiveId);
      return obj && obj.division === div;
    });
    const avgScore = divKRs.length > 0
      ? Math.round(divKRs.reduce((sum, kr) => sum + (kr.score || 0), 0) / divKRs.length)
      : 0;
    
    let status = 'on-track';
    if (avgScore >= 85) status = 'excellent';
    else if (avgScore < 60) status = 'at-risk';
    
    return {
      name: div || 'Unknown',
      description: divObjs[0]?.description || '',
      objectives: divObjs.length,
      keyResults: divKRs.length,
      avgScore,
      status,
      owner: divObjs[0]?.ownerId || 'Unknown',
      team: Math.floor(divObjs.length * 7.5), // Estimate
      color: divisionColors[div || ''] || '#3b82f6'
    };
  });

  const radialData = divisionsData.map(d => ({
    name: d.name,
    score: d.avgScore,
    fill: d.color
  }));

  if (loading) {
    return <div className="text-center text-muted-foreground">Loading...</div>;
  }
  const getStatusBadge = (status: string) => {
    const config = {
      excellent: { variant: 'default' as const, className: 'bg-green-100 text-green-800 border-green-200' },
      'on-track': { variant: 'default' as const, className: 'bg-blue-100 text-blue-800 border-blue-200' },
      'at-risk': { variant: 'default' as const, className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      behind: { variant: 'default' as const, className: 'bg-red-100 text-red-800 border-red-200' }
    };
    return config[status as keyof typeof config] || config['on-track'];
  };

  return (
    <div className="space-y-6">
      {/* Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Division Overview</CardTitle>
          <CardDescription>
            Performance metrics and objectives across all IT divisions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Bar Chart */}
            <div>
              <h3 className="mb-4 text-sm font-medium">Average Score by Division</h3>
              <ChartAccessible
                summary={`Bar chart of average key result score by division: ${divisionsData.map((d) => `${d.name} ${d.avgScore}%`).join('; ')}.`}
              >
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={divisionsData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" domain={[0, 100]} className="text-xs" />
                  <YAxis dataKey="name" type="category" width={120} className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="avgScore" fill="#3b82f6" name="Avg Score (%)" />
                </BarChart>
              </ResponsiveContainer>
              </ChartAccessible>
            </div>

            {/* Radial Chart */}
            <div>
              <h3 className="mb-4 text-sm font-medium">Performance Distribution</h3>
              <ChartAccessible
                summary={`Radial chart of division average scores: ${radialData.map((r) => `${r.name} ${r.score}%`).join('; ')}.`}
              >
              <ResponsiveContainer width="100%" height={300}>
                <RadialBarChart 
                  cx="50%" 
                  cy="50%" 
                  innerRadius="20%" 
                  outerRadius="90%" 
                  data={radialData}
                  startAngle={180}
                  endAngle={0}
                >
                  <RadialBar
                    label={{ position: 'insideStart', fill: '#fff', fontSize: 12 }}
                    background
                    dataKey="score"
                  />
                  <Legend 
                    iconSize={10} 
                    layout="vertical" 
                    verticalAlign="middle" 
                    align="right"
                  />
                  <Tooltip />
                </RadialBarChart>
              </ResponsiveContainer>
              </ChartAccessible>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Division Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {divisionsData.map((division) => {
          const statusConfig = getStatusBadge(division.status);
          return (
            <Card key={division.name} className="hover:shadow-lg transition-shadow" style={{ borderTopWidth: 4, borderTopColor: division.color }}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="flex h-12 w-12 items-center justify-center rounded-lg text-white"
                      style={{ backgroundColor: division.color }}
                    >
                      <Building2 className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle>{division.name}</CardTitle>
                      <CardDescription>{division.description}</CardDescription>
                    </div>
                  </div>
                  <Badge className={statusConfig.className}>
                    {division.status.replace('-', ' ')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Score */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Average Score</span>
                    <span className="text-2xl font-bold" style={{ color: division.color }}>
                      {division.avgScore}%
                    </span>
                  </div>
                  <Progress value={division.avgScore} className="h-2" />
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                  <div>
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Target className="h-4 w-4" />
                      <span className="text-xs">Objectives</span>
                    </div>
                    <p className="text-2xl font-bold">{division.objectives}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-xs">Key Results</span>
                    </div>
                    <p className="text-2xl font-bold">{division.keyResults}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Users className="h-4 w-4" />
                      <span className="text-xs">Team Size</span>
                    </div>
                    <p className="text-2xl font-bold">{division.team}</p>
                  </div>
                </div>

                {/* Owner */}
                <div className="pt-4 border-t">
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Owner:</span>
                    <span className="font-medium">{division.owner}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Attention Required */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            Divisions Requiring Attention
          </CardTitle>
          <CardDescription>
            Divisions with below-target performance or critical blockers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {divisionsData
              .filter(d => d.avgScore < 70)
              .map((division) => (
                <div 
                  key={division.name} 
                  className="flex items-center justify-between border-l-4 bg-yellow-50 p-4 rounded-r-lg"
                  style={{ borderLeftColor: division.color }}
                >
                  <div className="flex items-center gap-4">
                    <div 
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-white"
                      style={{ backgroundColor: division.color }}
                    >
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{division.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {division.keyResults} key results tracked
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className="border-yellow-500 text-yellow-700">
                      Needs Support
                    </Badge>
                    <span className="text-xl font-bold text-yellow-600">{division.avgScore}%</span>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  Users,
  Clock,
  Briefcase,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  CalendarCheck,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

export default function AdminDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/dashboard/admin');
      setData(res.data);
    } catch (err: any) {
      console.error('Failed to load admin dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      </AppLayout>
    );
  }

  const s = data?.summary;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              Admin Command Center
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Live organization metrics, employee attendance health, and task productivity.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a href="/admin/approvals">
              <Button
                variant={s?.pendingCorrections > 0 ? 'primary' : 'outline'}
                size="sm"
                icon={<CheckCircle2 className="w-4 h-4" />}
              >
                {s?.pendingCorrections} Pending Approvals
              </Button>
            </a>
          </div>
        </div>

        {/* Highlight Alert for Missing Punchouts or Pending Approvals */}
        {(s?.missingPunchOuts > 0 || s?.pendingCorrections > 0) && (
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <span>
                <strong>Action Required:</strong> {s?.pendingCorrections} pending attendance correction requests &bull; {s?.missingPunchOuts} incomplete attendance sessions detected.
              </span>
            </div>
            <a
              href="/admin/approvals"
              className="font-bold underline hover:text-amber-700 dark:hover:text-amber-100 shrink-0"
            >
              Review Corrections &rarr;
            </a>
          </div>
        )}

        {/* 8 Metric Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Total Employees
                </p>
                <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
                  {s?.totalUsers || 0}
                </h3>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 block font-medium">
                  {s?.activeUsers || 0} Active accounts
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Currently Punched In
                </p>
                <h3 className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                  {s?.currentlyPunchedIn || 0}
                </h3>
                <span className="text-xs text-slate-400 mt-0.5 block">
                  Active working sessions
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Clock className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Total Attendance Hours Today
                </p>
                <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
                  {s?.totalAttendanceHoursToday || 0} hrs
                </h3>
                <span className="text-xs text-slate-400 mt-0.5 block">
                  Recorded across workforce
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CalendarCheck className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Task Time Logged Today
                </p>
                <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
                  {s?.totalTaskHoursToday || 0} hrs
                </h3>
                <span className="text-xs text-slate-400 mt-0.5 block">
                  Tracked on deliverables
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Tasks In Progress
                </p>
                <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
                  {s?.tasks?.IN_PROGRESS || 0}
                </h3>
                <span className="text-xs text-slate-400 mt-0.5 block">
                  {s?.tasks?.TODO || 0} awaiting pickup
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Briefcase className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Tasks Completed
                </p>
                <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
                  {s?.tasks?.COMPLETED || 0}
                </h3>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 block font-medium">
                  Verified deliverables
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Pending Approvals
                </p>
                <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                  {s?.pendingCorrections || 0}
                </h3>
                <span className="text-xs text-slate-400 mt-0.5 block">
                  Previous-day corrections
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Missing Punch-outs
                </p>
                <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
                  {s?.missingPunchOuts || 0}
                </h3>
                <span className="text-xs text-slate-400 mt-0.5 block">
                  Incomplete sessions flagged
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <Clock className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 7-Day Company Hours Trend Chart */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base">Company-wide Hours Comparison</CardTitle>
              <CardDescription className="text-xs">
                Attendance clock-in duration vs logged task time across all employees (Last 7 Days)
              </CardDescription>
            </div>
            <TrendingUp className="w-5 h-5 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="h-80 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.weeklyTrends || []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="h" />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '0.75rem',
                      fontSize: '0.75rem',
                      border: 'none',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '10px' }} />
                  <Bar dataKey="attendanceHours" name="Total Attendance Hours" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="taskHours" name="Total Task Hours Logged" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

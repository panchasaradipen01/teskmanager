'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatMinutes, formatTimeDisplay } from '@/lib/utils';
import {
  Clock,
  PlayCircle,
  StopCircle,
  CheckCircle2,
  ListTodo,
  TrendingUp,
  PlusCircle,
  AlertCircle,
  Briefcase,
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

export default function UserDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPunching, setIsPunching] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Quick Time Entry Modal
  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [workDescription, setWorkDescription] = useState('');
  const [isSubmittingTime, setIsSubmittingTime] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      const [dashRes, tasksRes] = await Promise.all([
        api.get('/dashboard/user'),
        api.get('/tasks', { limit: 100 }),
      ]);
      setData(dashRes.data);
      setTasks(tasksRes.data || []);
      if (tasksRes.data && tasksRes.data.length > 0 && !selectedTaskId) {
        setSelectedTaskId(tasksRes.data[0]._id);
      }
    } catch (err: any) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedTaskId]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handlePunchIn = async () => {
    setIsPunching(true);
    setActionMessage(null);
    try {
      const res = await api.post('/attendance/punch-in');
      setActionMessage({ type: 'success', text: res.message || 'Punched in successfully!' });
      await fetchDashboardData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Punch-in failed' });
    } finally {
      setIsPunching(false);
    }
  };

  const handlePunchOut = async () => {
    setIsPunching(true);
    setActionMessage(null);
    try {
      const res = await api.post('/attendance/punch-out');
      setActionMessage({ type: 'success', text: res.message || 'Punched out successfully!' });
      await fetchDashboardData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Punch-out failed' });
    } finally {
      setIsPunching(false);
    }
  };

  const handleLogTime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskId) return;

    setIsSubmittingTime(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      await api.post('/time-entries', {
        taskId: selectedTaskId,
        workDate: today,
        durationMinutes: Number(durationMinutes),
        description: workDescription,
      });
      setIsTimeModalOpen(false);
      setWorkDescription('');
      setActionMessage({ type: 'success', text: 'Time logged successfully!' });
      await fetchDashboardData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to log time' });
    } finally {
      setIsSubmittingTime(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-80 w-full rounded-2xl" />
        </div>
      </AppLayout>
    );
  }

  const attendance = data?.attendance;
  const isPunchedIn = attendance?.isPunchedIn;
  const isCompleted = !!attendance?.punchOutAt;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Welcome & Punch-In Hero Card */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 p-6 sm:p-8 text-white shadow-xl shadow-indigo-950/20">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Asia/Kolkata Business Portal</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Welcome back, {user?.name || 'Employee'}
              </h1>
              <p className="text-sm text-indigo-200 max-w-xl">
                Track your active tasks, manage daily attendance, and keep your work hours accurately logged.
              </p>
            </div>

            {/* Live Punch Controls */}
            <div className="flex flex-col sm:flex-row items-center gap-3 bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/10 shrink-0">
              <div className="text-center sm:text-right pr-2">
                <span className="text-[11px] uppercase tracking-wider text-indigo-200 block font-semibold">
                  Current Session
                </span>
                <span className="text-sm font-bold text-white">
                  {isPunchedIn
                    ? `In since ${formatTimeDisplay(attendance?.punchInAt)}`
                    : isCompleted
                    ? `Punched out at ${formatTimeDisplay(attendance?.punchOutAt)}`
                    : 'Not punched in yet'}
                </span>
              </div>

              {!isPunchedIn && !isCompleted && (
                <Button
                  variant="success"
                  size="md"
                  onClick={handlePunchIn}
                  isLoading={isPunching}
                  icon={<PlayCircle className="w-5 h-5" />}
                  className="w-full sm:w-auto font-bold shadow-lg shadow-emerald-950/40"
                >
                  Punch In Now
                </Button>
              )}

              {isPunchedIn && (
                <Button
                  variant="danger"
                  size="md"
                  onClick={handlePunchOut}
                  isLoading={isPunching}
                  icon={<StopCircle className="w-5 h-5" />}
                  className="w-full sm:w-auto font-bold shadow-lg shadow-rose-950/40"
                >
                  Punch Out
                </Button>
              )}

              {isCompleted && (
                <Badge variant="success" className="px-3 py-1 text-xs">
                  Session Completed Today
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Action Message Alert */}
        {actionMessage && (
          <div
            className={`p-4 rounded-xl flex items-center justify-between border ${
              actionMessage.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-800 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 text-rose-800 dark:text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              {actionMessage.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600" />
              )}
              <span>{actionMessage.text}</span>
            </div>
            <button
              onClick={() => setActionMessage(null)}
              className="text-xs font-bold hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Attendance Today
                </p>
                <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
                  {formatMinutes(attendance?.durationMinutes || 0)}
                </h3>
                <span className="text-xs text-slate-400 mt-0.5 block">
                  Status: {attendance?.record?.status || 'No Session'}
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
                  Task Time Logged Today
                </p>
                <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
                  {data?.taskHoursToday} hrs
                </h3>
                <span className="text-xs text-slate-400 mt-0.5 block">
                  {data?.taskMinutesToday || 0} minutes total
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
                  Active Tasks
                </p>
                <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
                  {(data?.tasks?.TODO || 0) + (data?.tasks?.IN_PROGRESS || 0)}
                </h3>
                <span className="text-xs text-slate-400 mt-0.5 block">
                  {data?.tasks?.IN_PROGRESS || 0} In Progress &bull; {data?.tasks?.TODO || 0} To Do
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <ListTodo className="w-6 h-6" />
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
                  {data?.tasks?.COMPLETED || 0}
                </h3>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 block font-medium">
                  Across all assignments
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Briefcase className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Weekly Trend Chart & Quick Time Logger */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base">Weekly Working-Hours Trend</CardTitle>
                <CardDescription className="text-xs">
                  Independent comparison of clock-in duration vs logged task hours (Last 7 Days)
                </CardDescription>
              </div>
              <TrendingUp className="w-5 h-5 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.weeklyTrends || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                    <Bar dataKey="attendanceHours" name="Attendance Duration (hrs)" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="taskHours" name="Task Logged Time (hrs)" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions & Recent Entries */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base">Quick Logger</CardTitle>
                <CardDescription className="text-xs">Log today&apos;s time entry</CardDescription>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsTimeModalOpen(true)}
                icon={<PlusCircle className="w-4 h-4" />}
              >
                Log Time
              </Button>
            </CardHeader>
            <CardContent>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Recent Time Entries
              </h4>
              {data?.recentEntries && data.recentEntries.length > 0 ? (
                <div className="space-y-2.5">
                  {data.recentEntries.map((entry: any) => (
                    <div
                      key={entry._id}
                      className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <strong className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[150px]">
                          {entry.taskId?.title || 'General Task'}
                        </strong>
                        <Badge variant="primary">{formatMinutes(entry.durationMinutes)}</Badge>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 line-clamp-1">
                        {entry.description}
                      </p>
                      <span className="text-[10px] text-slate-400 block">{entry.workDate}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 py-6 text-center">No recent entries found.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Log Time Modal */}
      <Modal
        isOpen={isTimeModalOpen}
        onClose={() => setIsTimeModalOpen(false)}
        title="Log Time Spent on Task"
        description="Record the duration and work performed for today."
      >
        <form onSubmit={handleLogTime} className="space-y-4">
          <Select
            label="Select Task"
            value={selectedTaskId}
            onChange={(e) => setSelectedTaskId(e.target.value)}
            options={tasks.map((t) => ({ value: t._id, label: t.title }))}
            required
          />

          <Input
            label="Duration in Minutes"
            type="number"
            min={1}
            max={1440}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
            helperText={`${formatMinutes(durationMinutes)}`}
            required
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Work Description
            </label>
            <textarea
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              rows={3}
              placeholder="Detailed description of activities and deliverables completed..."
              value={workDescription}
              onChange={(e) => setWorkDescription(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsTimeModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmittingTime}>
              Record Entry
            </Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}

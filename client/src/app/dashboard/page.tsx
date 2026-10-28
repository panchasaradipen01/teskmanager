'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatMinutes, formatTimeDisplay } from '@/lib/utils';
import { parseDurationString, formatHumanDuration } from '@/lib/duration';
import { logTimeSchema, getZodFieldErrors } from '@/lib/validations';
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
  const toast = useToast();
  const [data, setData] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPunching, setIsPunching] = useState(false);

  // Quick Time Entry Modal
  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [durationInput, setDurationInput] = useState('1h 0m');
  const [workDescription, setWorkDescription] = useState('');
  const [logTimeErrors, setLogTimeErrors] = useState<Record<string, string>>({});
  const [isSubmittingTime, setIsSubmittingTime] = useState(false);
  const [todayStr, setTodayStr] = useState('');
  const [yesterdayStr, setYesterdayStr] = useState('');
  const [workDate, setWorkDate] = useState('');
  const [backdateReason, setBackdateReason] = useState('');

  useEffect(() => {
    const now = new Date();
    const t = now.toISOString().split('T')[0];
    const y = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setTodayStr(t);
    setYesterdayStr(y);
    setWorkDate(t);
  }, []);

  const parsedMinutes = parseDurationString(durationInput);

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
    try {
      const res = await api.post('/attendance/punch-in');
      toast.success(res.message || 'Punched in successfully!');
      await fetchDashboardData();
    } catch (err: any) {
      toast.error(err.message || 'Punch-in failed');
    } finally {
      setIsPunching(false);
    }
  };

  const handlePunchOut = async () => {
    setIsPunching(true);
    try {
      const res = await api.post('/attendance/punch-out');
      toast.success(res.message || 'Punched out successfully!');
      await fetchDashboardData();
    } catch (err: any) {
      toast.error(err.message || 'Punch-out failed');
    } finally {
      setIsPunching(false);
    }
  };

  const handleLogTime = async (e: React.FormEvent) => {
    e.preventDefault();
    setLogTimeErrors({});

    const validation = logTimeSchema.safeParse({
      taskId: selectedTaskId,
      workDate,
      durationMinutes: parsedMinutes,
      description: workDescription.trim(),
      backdateReason: workDate === yesterdayStr ? backdateReason.trim() : undefined,
    });

    if (!validation.success) {
      setLogTimeErrors(getZodFieldErrors(validation.error));
      return;
    }

    if (workDate < yesterdayStr) {
      setLogTimeErrors({ workDate: 'Logging time is limited to today and yesterday. Past dates beyond -1 day are locked.' });
      return;
    }

    if (workDate > todayStr) {
      setLogTimeErrors({ workDate: 'Cannot record time entries for future dates.' });
      return;
    }

    if (workDate === yesterdayStr && (!backdateReason || backdateReason.trim().length < 5)) {
      setLogTimeErrors({ backdateReason: 'A mandatory explanation note (at least 5 characters) is required when recording time for yesterday.' });
      return;
    }

    setIsSubmittingTime(true);
    try {
      await api.post('/time-entries', {
        taskId: selectedTaskId,
        workDate,
        durationMinutes: parsedMinutes,
        description: workDescription.trim(),
        backdateReason: workDate === yesterdayStr ? backdateReason.trim() : undefined,
      });
      setIsTimeModalOpen(false);
      setWorkDescription('');
      setBackdateReason('');
      setLogTimeErrors({});
      toast.success(`Logged ${formatHumanDuration(parsedMinutes)} successfully!`);
      await fetchDashboardData();
    } catch (err: any) {
      if (err.details && Array.isArray(err.details)) {
        const bErrors: Record<string, string> = {};
        err.details.forEach((d: any) => {
          if (d.field) bErrors[d.field] = d.message;
        });
        setLogTimeErrors(bErrors);
      }
      toast.error(err.message || 'Failed to log time');
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
                  {formatHumanDuration(data?.taskMinutesToday || 0)}
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
                onClick={() => {
                  setDurationInput('1h 0m');
                  setIsTimeModalOpen(true);
                }}
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
        description="Record the duration and work performed for today or yesterday."
      >
        <form onSubmit={handleLogTime} className="space-y-4" noValidate>
          <Select
            label="Select Task"
            value={selectedTaskId}
            error={logTimeErrors.taskId}
            onChange={(e) => {
              setSelectedTaskId(e.target.value);
              if (logTimeErrors.taskId) setLogTimeErrors((p) => { const n = { ...p }; delete n.taskId; return n; });
            }}
            options={tasks.map((t) => ({ value: t._id, label: t.title }))}
            required
          />

          <Input
            label="Work Date (YYYY-MM-DD)"
            type="date"
            min={yesterdayStr}
            max={todayStr}
            value={workDate}
            error={logTimeErrors.workDate}
            onChange={(e) => {
              setWorkDate(e.target.value);
              if (logTimeErrors.workDate) setLogTimeErrors((p) => { const n = { ...p }; delete n.workDate; return n; });
            }}
            helperText="Logging permitted only for today or yesterday. Past dates beyond -1 day are locked."
            required
          />

          <Input
            label="Duration (e.g. 1h 0m, 1d 1h 10m, 1w 1d 1h 10m)"
            type="text"
            placeholder="e.g. 1h 0m, 1d 1h 10m, 45m"
            value={durationInput}
            error={logTimeErrors.durationMinutes}
            onChange={(e) => {
              setDurationInput(e.target.value);
              if (logTimeErrors.durationMinutes) setLogTimeErrors((p) => { const n = { ...p }; delete n.durationMinutes; return n; });
            }}
            helperText={
              parsedMinutes > 0
                ? `Interpreted as: ${formatHumanDuration(parsedMinutes)} (${parsedMinutes} minutes)`
                : 'Enter duration using w, d, h, m (e.g. 1w 1d 1h 10m, 1d 2h, 45m)'
            }
            required
          />

          {workDate === yesterdayStr && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 space-y-1.5">
              <Textarea
                label="Mandatory Previous-Day Explanation Note"
                rows={2}
                placeholder="Explain why this entry is being logged for yesterday..."
                value={backdateReason}
                error={logTimeErrors.backdateReason}
                onChange={(e) => {
                  setBackdateReason(e.target.value);
                  if (logTimeErrors.backdateReason) setLogTimeErrors((p) => { const n = { ...p }; delete n.backdateReason; return n; });
                }}
                minLength={5}
                required
              />
            </div>
          )}

          <Textarea
            label="Work Description"
            rows={3}
            placeholder="Detailed description of activities and deliverables completed..."
            value={workDescription}
            error={logTimeErrors.description}
            onChange={(e) => {
              setWorkDescription(e.target.value);
              if (logTimeErrors.description) setLogTimeErrors((p) => { const n = { ...p }; delete n.description; return n; });
            }}
            required
          />

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setIsTimeModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmittingTime} disabled={parsedMinutes <= 0}>
              Record Entry
            </Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}

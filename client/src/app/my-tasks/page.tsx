'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useToast } from '@/context/ToastContext';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { formatMinutes } from '@/lib/utils';
import { parseDurationString, formatHumanDuration } from '@/lib/duration';
import { createTaskSchema, logTimeSchema, getZodFieldErrors } from '@/lib/validations';
import {
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Search,
  Filter,
  Trash2,
  Edit2,
  Calendar,
} from 'lucide-react';

export default function MyTasksPage() {
  const toast = useToast();
  const [tasks, setTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isLogTimeOpen, setIsLogTimeOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<any>(null);

  // Form states
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskPriority, setTaskPriority] = useState('MEDIUM');
  const [taskStatus, setTaskStatus] = useState('TODO');
  const [taskErrors, setTaskErrors] = useState<Record<string, string>>({});
  const [logTimeErrors, setLogTimeErrors] = useState<Record<string, string>>({});

  // Log Time form states
  const [todayStr, setTodayStr] = useState('');
  const [yesterdayStr, setYesterdayStr] = useState('');
  const [workDate, setWorkDate] = useState('');

  useEffect(() => {
    const t = new Date().toISOString().split('T')[0];
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yStr = y.toISOString().split('T')[0];
    setTodayStr(t);
    setYesterdayStr(yStr);
    setWorkDate(t);
  }, []);

  const [durationInput, setDurationInput] = useState('1h 0m');
  const [workPerformed, setWorkPerformed] = useState('');
  const [backdateReason, setBackdateReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parsedMinutes = parseDurationString(durationInput);

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/tasks', {
        search,
        status: statusFilter,
        limit: 50,
      });
      setTasks(res.data || []);
    } catch (err: any) {
      console.error('Failed to load tasks:', err);
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setTaskErrors({});

    const validation = createTaskSchema.safeParse({
      title: taskTitle.trim(),
      description: taskDescription.trim(),
      priority: taskPriority,
      status: taskStatus,
    });

    if (!validation.success) {
      setTaskErrors(getZodFieldErrors(validation.error));
      return;
    }

    setIsSubmitting(true);

    try {
      await api.post('/tasks', {
        title: taskTitle.trim(),
        description: taskDescription.trim(),
        priority: taskPriority,
        status: taskStatus,
      });
      setIsCreateOpen(false);
      setTaskTitle('');
      setTaskDescription('');
      setTaskErrors({});
      toast.success('Task created successfully!');
      await fetchTasks();
    } catch (err: any) {
      if (err.details && Array.isArray(err.details)) {
        const bErrors: Record<string, string> = {};
        err.details.forEach((d: any) => {
          if (d.field) bErrors[d.field] = d.message;
        });
        setTaskErrors(bErrors);
      }
      toast.error(err.message || 'Failed to create task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTask) return;
    setTaskErrors({});

    const validation = createTaskSchema.safeParse({
      title: taskTitle.trim(),
      description: taskDescription.trim(),
      priority: taskPriority,
      status: taskStatus,
    });

    if (!validation.success) {
      setTaskErrors(getZodFieldErrors(validation.error));
      return;
    }

    setIsSubmitting(true);

    try {
      await api.patch(`/tasks/${activeTask._id}`, {
        title: taskTitle.trim(),
        description: taskDescription.trim(),
        priority: taskPriority,
        status: taskStatus,
      });
      setIsEditOpen(false);
      setTaskErrors({});
      toast.success('Task updated successfully!');
      await fetchTasks();
    } catch (err: any) {
      if (err.details && Array.isArray(err.details)) {
        const bErrors: Record<string, string> = {};
        err.details.forEach((d: any) => {
          if (d.field) bErrors[d.field] = d.message;
        });
        setTaskErrors(bErrors);
      }
      toast.error(err.message || 'Failed to update task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogTime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTask) return;
    setLogTimeErrors({});

    const validation = logTimeSchema.safeParse({
      taskId: activeTask._id,
      workDate,
      durationMinutes: parsedMinutes,
      description: workPerformed.trim(),
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

    setIsSubmitting(true);

    try {
      await api.post('/time-entries', {
        taskId: activeTask._id,
        workDate,
        durationMinutes: parsedMinutes,
        description: workPerformed.trim(),
        backdateReason: workDate === yesterdayStr ? backdateReason.trim() : undefined,
      });
      setIsLogTimeOpen(false);
      setWorkPerformed('');
      setBackdateReason('');
      setLogTimeErrors({});
      toast.success(`Logged ${formatHumanDuration(parsedMinutes)} successfully!`);
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
      setIsSubmitting(false);
    }
  };

  const openEdit = (task: any) => {
    setActiveTask(task);
    setTaskTitle(task.title);
    setTaskDescription(task.description);
    setTaskPriority(task.priority);
    setTaskStatus(task.status);
    setTaskErrors({});
    setIsEditOpen(true);
  };

  const openLogTime = (task: any) => {
    setActiveTask(task);
    setWorkDate(todayStr);
    setDurationInput('1h 0m');
    setWorkPerformed('');
    setBackdateReason('');
    setLogTimeErrors({});
    setIsLogTimeOpen(true);
  };

  const priorityBadge = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return <Badge variant="danger">Urgent</Badge>;
      case 'HIGH':
        return <Badge variant="warning">High</Badge>;
      case 'MEDIUM':
        return <Badge variant="primary">Medium</Badge>;
      default:
        return <Badge variant="default">Low</Badge>;
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge variant="success">Completed</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="primary">In Progress</Badge>;
      case 'BLOCKED':
        return <Badge variant="danger">Blocked</Badge>;
      default:
        return <Badge variant="default">To Do</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              My Task Board
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Create, organize, and log working hours directly against your deliverables.
            </p>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setTaskTitle('');
              setTaskDescription('');
              setTaskPriority('MEDIUM');
              setTaskStatus('TODO');
              setIsCreateOpen(true);
            }}
            icon={<PlusCircle className="w-4 h-4" />}
          >
            Create New Task
          </Button>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search tasks by title or keywords..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300"
          >
            <option value="">All Statuses</option>
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="BLOCKED">Blocked</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>

        {/* Task Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tasks.map((task) => (
            <Card key={task._id} className="flex flex-col justify-between hover:shadow-md transition-shadow h-full">
              <CardContent className="p-5 flex-1 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {statusBadge(task.status)}
                    {priorityBadge(task.priority)}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(task)}
                      className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Edit task"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 line-clamp-1">
                    {task.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-3 leading-relaxed">
                    {task.description}
                  </p>
                </div>
              </CardContent>

              <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between mt-auto bg-slate-50/50 dark:bg-slate-900/50 rounded-b-xl">
                <span className="inline-flex items-center text-xs font-medium text-slate-500 dark:text-slate-400">
                  {new Date(task.createdAt).toLocaleDateString()}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => openLogTime(task)}
                  icon={<Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                  className="text-xs bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 dark:text-indigo-300 dark:border-indigo-800/80 shadow-2xs font-semibold"
                >
                  Log Time
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {tasks.length === 0 && !isLoading && (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            <Briefcase className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No tasks found
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Get started by creating your first task to track progress and record work duration.
            </p>
          </div>
        )}
      </div>

      {/* Create Task Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Task"
        description="Add a task with actionable deliverables."
      >
        <form onSubmit={handleCreateTask} className="space-y-4" noValidate>
          <Input
            label="Task Title"
            placeholder="e.g. Design User Dashboard UI components"
            value={taskTitle}
            error={taskErrors.title}
            onChange={(e) => {
              setTaskTitle(e.target.value);
              if (taskErrors.title) setTaskErrors((p) => { const n = { ...p }; delete n.title; return n; });
            }}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Priority"
              value={taskPriority}
              onChange={(e) => setTaskPriority(e.target.value)}
              options={[
                { value: 'LOW', label: 'Low' },
                { value: 'MEDIUM', label: 'Medium' },
                { value: 'HIGH', label: 'High' },
                { value: 'URGENT', label: 'Urgent' },
              ]}
              required
            />
            <Select
              label="Status"
              value={taskStatus}
              onChange={(e) => setTaskStatus(e.target.value)}
              options={[
                { value: 'TODO', label: 'To Do' },
                { value: 'IN_PROGRESS', label: 'In Progress' },
                { value: 'BLOCKED', label: 'Blocked' },
                { value: 'COMPLETED', label: 'Completed' },
              ]}
              required
            />
          </div>

          <Textarea
            label="Task Description"
            rows={4}
            placeholder="Detailed description of objectives, technical notes, or steps..."
            value={taskDescription}
            error={taskErrors.description}
            onChange={(e) => {
              setTaskDescription(e.target.value);
              if (taskErrors.description) setTaskErrors((p) => { const n = { ...p }; delete n.description; return n; });
            }}
            required
          />

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              Create Task
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Task Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Task"
        description="Update task details or change completion status."
      >
        <form onSubmit={handleUpdateTask} className="space-y-4" noValidate>
          <Input
            label="Task Title"
            value={taskTitle}
            error={taskErrors.title}
            onChange={(e) => {
              setTaskTitle(e.target.value);
              if (taskErrors.title) setTaskErrors((p) => { const n = { ...p }; delete n.title; return n; });
            }}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Priority"
              value={taskPriority}
              onChange={(e) => setTaskPriority(e.target.value)}
              options={[
                { value: 'LOW', label: 'Low' },
                { value: 'MEDIUM', label: 'Medium' },
                { value: 'HIGH', label: 'High' },
                { value: 'URGENT', label: 'Urgent' },
              ]}
              required
            />
            <Select
              label="Status"
              value={taskStatus}
              onChange={(e) => setTaskStatus(e.target.value)}
              options={[
                { value: 'TODO', label: 'To Do' },
                { value: 'IN_PROGRESS', label: 'In Progress' },
                { value: 'BLOCKED', label: 'Blocked' },
                { value: 'COMPLETED', label: 'Completed' },
              ]}
              required
            />
          </div>

          <Textarea
            label="Task Description"
            rows={4}
            value={taskDescription}
            error={taskErrors.description}
            onChange={(e) => {
              setTaskDescription(e.target.value);
              if (taskErrors.description) setTaskErrors((p) => { const n = { ...p }; delete n.description; return n; });
            }}
            required
          />

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Log Time Modal with 1w 1d 1h 10m support */}
      <Modal
        isOpen={isLogTimeOpen}
        onClose={() => setIsLogTimeOpen(false)}
        title={`Log Work Duration — ${activeTask?.title || 'Task'}`}
        description="Record the time spent and deliverables achieved."
      >
        <form onSubmit={handleLogTime} className="space-y-4" noValidate>
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
            placeholder="What specifically did you work on or complete?"
            value={workPerformed}
            error={logTimeErrors.description}
            onChange={(e) => {
              setWorkPerformed(e.target.value);
              if (logTimeErrors.description) setLogTimeErrors((p) => { const n = { ...p }; delete n.description; return n; });
            }}
            required
          />

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setIsLogTimeOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting} disabled={parsedMinutes <= 0}>
              Save Time Entry
            </Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}

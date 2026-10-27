'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { formatMinutes } from '@/lib/utils';
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
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [workPerformed, setWorkPerformed] = useState('');
  const [backdateReason, setBackdateReason] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
    setIsSubmitting(true);
    setFeedback(null);

    try {
      await api.post('/tasks', {
        title: taskTitle,
        description: taskDescription,
        priority: taskPriority,
        status: taskStatus,
      });
      setIsCreateOpen(false);
      setTaskTitle('');
      setTaskDescription('');
      setFeedback({ type: 'success', text: 'Task created successfully!' });
      await fetchTasks();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to create task' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTask) return;
    setIsSubmitting(true);
    setFeedback(null);

    try {
      await api.patch(`/tasks/${activeTask._id}`, {
        title: taskTitle,
        description: taskDescription,
        priority: taskPriority,
        status: taskStatus,
      });
      setIsEditOpen(false);
      setFeedback({ type: 'success', text: 'Task updated successfully!' });
      await fetchTasks();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to update task' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogTime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTask) return;
    setIsSubmitting(true);
    setFeedback(null);

    try {
      await api.post('/time-entries', {
        taskId: activeTask._id,
        workDate,
        durationMinutes: Number(durationMinutes),
        description: workPerformed,
        backdateReason: workDate === yesterdayStr ? backdateReason : undefined,
      });
      setIsLogTimeOpen(false);
      setWorkPerformed('');
      setBackdateReason('');
      setFeedback({ type: 'success', text: 'Time logged successfully!' });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to log time' });
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
    setIsEditOpen(true);
  };

  const openLogTime = (task: any) => {
    setActiveTask(task);
    setWorkDate(todayStr);
    setDurationMinutes(60);
    setWorkPerformed('');
    setBackdateReason('');
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

        {feedback && (
          <div
            className={`p-4 rounded-xl flex items-center justify-between border ${
              feedback.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 text-rose-800'
            }`}
          >
            <div className="flex items-center gap-2 text-sm">
              {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
              <span>{feedback.text}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="text-xs font-bold hover:underline">
              Dismiss
            </button>
          </div>
        )}

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
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300"
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
            <Card key={task._id} className="flex flex-col justify-between hover:shadow-md transition-shadow">
              <CardContent className="p-5 space-y-3">
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

              <div className="px-5 pb-5 pt-0 border-t border-slate-100 dark:border-slate-800/80 mt-2 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {new Date(task.createdAt).toLocaleDateString()}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openLogTime(task)}
                  icon={<Clock className="w-3.5 h-3.5" />}
                  className="text-xs"
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
        <form onSubmit={handleCreateTask} className="space-y-4">
          <Input
            label="Task Title"
            placeholder="e.g. Design User Dashboard UI components"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
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
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Task Description
            </label>
            <textarea
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              rows={4}
              placeholder="Detailed description of objectives, technical notes, or steps..."
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsCreateOpen(false)}>
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
        <form onSubmit={handleUpdateTask} className="space-y-4">
          <Input
            label="Task Title"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
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
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Task Description
            </label>
            <textarea
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              rows={4}
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Log Time Modal */}
      <Modal
        isOpen={isLogTimeOpen}
        onClose={() => setIsLogTimeOpen(false)}
        title={`Log Work Duration — ${activeTask?.title || 'Task'}`}
        description="Record the time spent and deliverables achieved."
      >
        <form onSubmit={handleLogTime} className="space-y-4">
          <Input
            label="Work Date (YYYY-MM-DD)"
            type="date"
            max={todayStr}
            value={workDate}
            onChange={(e) => setWorkDate(e.target.value)}
            helperText="Direct logging permitted for today or yesterday."
            required
          />

          <Input
            label="Duration in Minutes"
            type="number"
            min={1}
            max={1440}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
            helperText={`Calculated duration: ${formatMinutes(durationMinutes)}`}
            required
          />

          {workDate === yesterdayStr && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 space-y-1.5">
              <label className="block text-xs font-bold text-amber-800 dark:text-amber-300 uppercase">
                Mandatory Previous-Day Explanation Note
              </label>
              <textarea
                className="w-full rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 p-2 text-xs focus:outline-none"
                rows={2}
                placeholder="Explain why this entry is being logged for yesterday..."
                value={backdateReason}
                onChange={(e) => setBackdateReason(e.target.value)}
                minLength={5}
                required
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Work Performed
            </label>
            <textarea
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              rows={3}
              placeholder="What specifically did you work on or complete?"
              value={workPerformed}
              onChange={(e) => setWorkPerformed(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsLogTimeOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              Save Time Entry
            </Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}

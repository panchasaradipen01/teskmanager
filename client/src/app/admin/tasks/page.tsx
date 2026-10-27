'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { formatMinutes, formatDateDisplay } from '@/lib/utils';
import { Briefcase, Clock, Search, Filter } from 'lucide-react';

export default function AdminTasksPage() {
  const [tab, setTab] = useState<'tasks' | 'timeEntries'>('tasks');
  const [tasks, setTasks] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      if (tab === 'tasks') {
        const res = await api.get('/tasks', { page: currentPage, limit: 15 });
        setTasks(res.data || []);
        if (res.meta) {
          setTotalPages(res.meta.totalPages);
          setTotalRecords(res.meta.total);
        }
      } else {
        const res = await api.get('/time-entries', { page: currentPage, limit: 15 });
        setEntries(res.data || []);
        if (res.meta) {
          setTotalPages(res.meta.totalPages);
          setTotalRecords(res.meta.total);
        }
      }
    } catch (err: any) {
      console.error('Failed to load data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [tab, currentPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const taskColumns: Column<any>[] = [
    {
      header: 'Assigned Employee',
      cell: (row) => (
        <div>
          <strong className="font-semibold text-slate-900 dark:text-slate-100 block">
            {row.userId?.name || 'N/A'}
          </strong>
          <span className="text-xs text-slate-500 font-mono">
            {row.userId?.employeeId} &bull; {row.userId?.department}
          </span>
        </div>
      ),
    },
    {
      header: 'Task Title',
      cell: (row) => (
        <div>
          <strong className="text-slate-900 dark:text-slate-100 block">{row.title}</strong>
          <span className="text-xs text-slate-500 line-clamp-1">{row.description}</span>
        </div>
      ),
    },
    {
      header: 'Priority',
      cell: (row) => (
        <Badge variant={row.priority === 'URGENT' ? 'danger' : row.priority === 'HIGH' ? 'warning' : 'primary'}>
          {row.priority}
        </Badge>
      ),
    },
    {
      header: 'Status',
      cell: (row) => (
        <Badge variant={row.status === 'COMPLETED' ? 'success' : row.status === 'IN_PROGRESS' ? 'primary' : 'default'}>
          {row.status}
        </Badge>
      ),
    },
    {
      header: 'Created Date',
      cell: (row) => <span className="text-xs text-slate-500">{new Date(row.createdAt).toLocaleDateString()}</span>,
    },
  ];

  const entryColumns: Column<any>[] = [
    {
      header: 'Employee',
      cell: (row) => (
        <div>
          <strong className="font-semibold text-slate-900 dark:text-slate-100 block">
            {row.userId?.name || 'N/A'}
          </strong>
          <span className="text-xs text-slate-500 font-mono">{row.userId?.employeeId}</span>
        </div>
      ),
    },
    {
      header: 'Work Date',
      cell: (row) => (
        <span className="font-semibold text-slate-800 dark:text-slate-200">
          {formatDateDisplay(row.workDate)}
        </span>
      ),
    },
    {
      header: 'Task & Description',
      cell: (row) => (
        <div>
          <strong className="text-slate-900 dark:text-slate-100 block">{row.taskId?.title || 'General Task'}</strong>
          <p className="text-xs text-slate-500 line-clamp-1">{row.description}</p>
          {row.backdateReason && (
            <span className="text-[10px] text-amber-600 block italic">Note: {row.backdateReason}</span>
          )}
        </div>
      ),
    },
    {
      header: 'Duration',
      cell: (row) => (
        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
          {formatMinutes(row.durationMinutes)}
        </span>
      ),
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Company Deliverables & Time Logs
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Cross-organization visibility into task progress and work duration breakdown.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => {
                setTab('tasks');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                tab === 'tasks'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              All Tasks
            </button>
            <button
              onClick={() => {
                setTab('timeEntries');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                tab === 'timeEntries'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Time Logs
            </button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            {tab === 'tasks' ? (
              <DataTable
                columns={taskColumns}
                data={tasks}
                isLoading={isLoading}
                emptyMessage="No tasks found."
              />
            ) : (
              <DataTable
                columns={entryColumns}
                data={entries}
                isLoading={isLoading}
                emptyMessage="No time entries logged yet."
              />
            )}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalRecords={totalRecords}
              limit={15}
              onPageChange={setCurrentPage}
            />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { formatTimeDisplay, formatDateDisplay, formatMinutes } from '@/lib/utils';
import { ShieldCheck, Search, Filter } from 'lucide-react';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/audit-logs', {
        page: currentPage,
        limit: 15,
        action: actionFilter || undefined,
      });
      setLogs(res.data || []);
      if (res.meta) {
        setTotalPages(res.meta.totalPages);
        setTotalRecords(res.meta.total);
      }
    } catch (err: any) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, actionFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const renderAuditDetails = (row: any) => {
    if (row.reason) {
      return (
        <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
          {row.reason}
        </span>
      );
    }

    const obj = row.after || row.before;
    if (!obj || typeof obj !== 'object') {
      return <span className="text-slate-400 text-xs">—</span>;
    }

    // Custom human-friendly formatting based on action
    if (row.action === 'PUNCH_IN' && obj.punchInAt) {
      return (
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {formatDateDisplay(obj.attendanceDate)}
          </span>
          <span className="text-slate-400">&bull;</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
            In at {formatTimeDisplay(obj.punchInAt)}
          </span>
        </div>
      );
    }

    if (row.action === 'PUNCH_OUT' && obj.punchOutAt) {
      return (
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="text-slate-700 dark:text-slate-300 font-medium">
            Out at {formatTimeDisplay(obj.punchOutAt)}
          </span>
          {obj.durationMinutes !== undefined && (
            <>
              <span className="text-slate-400">&bull;</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                Duration: {formatMinutes(obj.durationMinutes)}
              </span>
            </>
          )}
        </div>
      );
    }

    if (row.action === 'TIME_ENTRY_CREATED' || row.action === 'TIME_ENTRY_UPDATED') {
      return (
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {obj.workDate && (
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {formatDateDisplay(obj.workDate)}
            </span>
          )}
          {obj.durationMinutes && (
            <>
              <span className="text-slate-400">&bull;</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                {formatMinutes(obj.durationMinutes)}
              </span>
            </>
          )}
        </div>
      );
    }

    if (row.action === 'USER_CREATED') {
      return (
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="font-medium text-slate-800 dark:text-slate-200">{obj.email}</span>
          <span className="text-slate-400">&bull;</span>
          <Badge variant="primary" className="text-[10px] py-0">{obj.role}</Badge>
        </div>
      );
    }

    if (row.action === 'USER_STATUS_CHANGED') {
      return (
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          Status changed to {obj.status}
        </span>
      );
    }

    // General object fallback: render clean key-value labels instead of JSON string
    return (
      <div className="flex items-center gap-1.5 flex-wrap text-xs">
        {Object.entries(obj).slice(0, 3).map(([key, val]) => (
          <span
            key={key}
            className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px] text-slate-700 dark:text-slate-300"
          >
            <span className="font-semibold text-slate-500 capitalize">{key}:</span>
            <span>
              {typeof val === 'string' && val.includes('T') && val.includes('Z')
                ? formatTimeDisplay(val)
                : String(val)}
            </span>
          </span>
        ))}
      </div>
    );
  };

  const columns: Column<any>[] = [
    {
      header: 'Time',
      className: 'w-32',
      cell: (row) => (
        <span className="font-mono text-xs text-slate-500 whitespace-nowrap block">
          {formatTimeDisplay(row.timestamp)}
        </span>
      ),
    },
    {
      header: 'Actor',
      className: 'w-44',
      cell: (row) => (
        <div className="truncate max-w-[170px]">
          <strong className="text-slate-900 dark:text-slate-100 block text-xs truncate">
            {row.actorUserId?.name || 'System / Guest'}
          </strong>
          {row.actorUserId?.employeeId && (
            <span className="text-[11px] text-slate-400 font-mono">
              {row.actorUserId.employeeId}
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Event',
      className: 'w-36',
      cell: (row) => (
        <Badge
          variant={
            row.action.includes('FAILED')
              ? 'danger'
              : row.action.includes('APPROVED') || row.action.includes('CREATED')
              ? 'success'
              : 'primary'
          }
          className="text-[10px] font-mono whitespace-nowrap"
        >
          {row.action}
        </Badge>
      ),
    },
    {
      header: 'Activity Details',
      className: 'min-w-[220px]',
      cell: (row) => renderAuditDetails(row),
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              System Audit Trail
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Immutable chronological record of logins, attendance adjustments, administrative actions, and task events.
            </p>
          </div>

          <div className="w-full sm:w-auto">
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full sm:w-auto px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-xs"
            >
              <option value="">All Audit Events</option>
              <option value="USER_LOGIN">User Logins</option>
              <option value="LOGIN_FAILED">Login Failures</option>
              <option value="PUNCH_IN">Punch In Events</option>
              <option value="PUNCH_OUT">Punch Out Events</option>
              <option value="ATTENDANCE_CORRECTION_REQUESTED">Correction Requests</option>
              <option value="ATTENDANCE_CORRECTION_REVIEWED">Correction Reviews</option>
              <option value="USER_CREATED">User Provisions</option>
              <option value="PASSWORD_RESET">Password Resets</option>
            </select>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <DataTable
              columns={columns}
              data={logs}
              isLoading={isLoading}
              emptyMessage="No audit trail events found."
            />
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

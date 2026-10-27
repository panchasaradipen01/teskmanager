'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
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
        limit: 20,
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

  const columns: Column<any>[] = [
    {
      header: 'Timestamp',
      cell: (row) => (
        <span className="font-mono text-xs text-slate-500">
          {new Date(row.timestamp).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })}
        </span>
      ),
    },
    {
      header: 'Actor',
      cell: (row) => (
        <div>
          <strong className="text-slate-900 dark:text-slate-100 block text-xs">
            {row.actorUserId?.name || 'System / Anonymous'}
          </strong>
          {row.actorUserId?.email && (
            <span className="text-[11px] text-slate-400 font-mono">{row.actorUserId.email}</span>
          )}
        </div>
      ),
    },
    {
      header: 'Action Event',
      cell: (row) => (
        <Badge
          variant={
            row.action.includes('FAILED')
              ? 'danger'
              : row.action.includes('APPROVED') || row.action.includes('CREATED')
              ? 'success'
              : 'primary'
          }
          className="text-[10px] font-mono"
        >
          {row.action}
        </Badge>
      ),
    },
    {
      header: 'Entity',
      cell: (row) => (
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          {row.entityType}
        </span>
      ),
    },
    {
      header: 'Details / Justification',
      cell: (row) => (
        <div className="text-xs text-slate-500 max-w-sm truncate" title={row.reason || JSON.stringify(row.after || {})}>
          {row.reason ? (
            <span className="italic">{row.reason}</span>
          ) : row.after ? (
            <span className="font-mono text-[11px]">{JSON.stringify(row.after)}</span>
          ) : (
            '—'
          )}
        </div>
      ),
    },
    {
      header: 'IP / Source',
      cell: (row) => (
        <span className="font-mono text-[11px] text-slate-400">
          {row.ipAddress || '127.0.0.1'}
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
              Security & Compliance Audit Trail
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Immutable chronological record of logins, attendance adjustments, administrative actions, and task events.
            </p>
          </div>

          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-700 dark:text-slate-300"
          >
            <option value="">All Audit Actions</option>
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
              limit={20}
              onPageChange={setCurrentPage}
            />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

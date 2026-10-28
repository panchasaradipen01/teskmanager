'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { formatMinutes, formatDateDisplay, formatTimeDisplay } from '@/lib/utils';
import { useToast } from '@/context/ToastContext';
import {
  Clock,
  Download,
  Search,
  Filter,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';

export default function AdminAttendancePage() {
  const { toast } = useToast();
  const [records, setRecords] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [exportingFormat, setExportingFormat] = useState<'xlsx' | 'csv' | null>(null);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users', { limit: 200 });
      setUsers(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAttendance = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/attendance', {
        page: currentPage,
        limit: 15,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        userId: selectedUser || undefined,
        status: statusFilter || undefined,
      });
      setRecords(res.data || []);
      if (res.meta) {
        setTotalPages(res.meta.totalPages);
        setTotalRecords(res.meta.total);
      }
    } catch (err: any) {
      console.error('Failed to load attendance:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, startDate, endDate, selectedUser, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const handleExport = async (format: 'xlsx' | 'csv') => {
    try {
      setExportingFormat(format);
      await api.download(
        '/attendance/export',
        {
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          userId: selectedUser || undefined,
          format,
        },
        `Attendance_Report_${startDate || 'all'}_to_${endDate || 'all'}.${format}`
      );
      toast.success(`Attendance report (${format.toUpperCase()}) downloaded successfully.`);
    } catch (err: any) {
      toast.error(`Export failed: ${err.message}`);
    } finally {
      setExportingFormat(null);
    }
  };

  const columns: Column<any>[] = [
    {
      header: 'Employee',
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
      header: 'Date',
      cell: (row) => (
        <span className="font-semibold text-slate-800 dark:text-slate-200">
          {formatDateDisplay(row.attendanceDate)}
        </span>
      ),
    },
    {
      header: 'Punch In',
      cell: (row) => (
        <span className="text-slate-600 dark:text-slate-300">
          {formatTimeDisplay(row.punchInAt)}
        </span>
      ),
    },
    {
      header: 'Punch Out',
      cell: (row) => (
        <span className="text-slate-600 dark:text-slate-300">
          {row.punchOutAt ? (
            formatTimeDisplay(row.punchOutAt)
          ) : (
            <Badge variant="warning" className="text-[10px]">
              Missing Punch-out
            </Badge>
          )}
        </span>
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
    {
      header: 'Status',
      cell: (row) => (
        <Badge
          variant={
            row.status === 'PRESENT'
              ? 'success'
              : row.status === 'HALF_DAY'
              ? 'warning'
              : 'default'
          }
        >
          {row.status}
        </Badge>
      ),
    },
    {
      header: 'Source',
      cell: (row) => (
        <span className="text-xs text-slate-400">
          {row.source === 'CORRECTION' ? 'Correction' : 'Web'}
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
              Employee Attendance Records
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Organization-wide view with date filters and report exports.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('xlsx')}
              isLoading={exportingFormat === 'xlsx'}
              disabled={exportingFormat !== null}
              icon={<FileSpreadsheet className="w-4 h-4 text-emerald-600" />}
            >
              Export Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('csv')}
              isLoading={exportingFormat === 'csv'}
              disabled={exportingFormat !== null}
              icon={<FileText className="w-4 h-4 text-indigo-600" />}
            >
              Export CSV
            </Button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Employee Filter
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-700 dark:text-slate-300"
            >
              <option value="">All Employees</option>
              {users.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name} ({u.employeeId})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Attendance Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-700 dark:text-slate-300"
            >
              <option value="">All Statuses</option>
              <option value="PRESENT">Present</option>
              <option value="HALF_DAY">Half Day</option>
              <option value="INCOMPLETE">Missing Punch-out</option>
            </select>
          </div>
        </div>

        {/* Attendance Data Table */}
        <Card>
          <CardContent className="p-0">
            <DataTable
              columns={columns}
              data={records}
              isLoading={isLoading}
              emptyMessage="No attendance records found matching filters."
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

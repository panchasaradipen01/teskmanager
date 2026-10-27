'use client';

import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FileSpreadsheet, FileText, Download, Calendar } from 'lucide-react';

export default function ReportsExportPage() {
  const [attStartDate, setAttStartDate] = useState('');
  const [attEndDate, setAttEndDate] = useState('');
  const [taskStartDate, setTaskStartDate] = useState('');
  const [taskEndDate, setTaskEndDate] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);

  const handleExportAttendance = async (format: 'xlsx' | 'csv') => {
    setIsDownloading(true);
    try {
      await api.download(
        '/reports/attendance',
        {
          startDate: attStartDate || undefined,
          endDate: attEndDate || undefined,
          format,
        },
        `TaskPulse_Attendance_Report.${format}`
      );
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleExportTime = async (format: 'xlsx' | 'csv') => {
    setIsDownloading(true);
    try {
      await api.download(
        '/reports/time-entries',
        {
          startDate: taskStartDate || undefined,
          endDate: taskEndDate || undefined,
          format,
        },
        `TaskPulse_TimeEntries_Report.${format}`
      );
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Reports & Data Exports
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Generate and download formatted Excel workbooks and raw CSV files for payroll and productivity analysis.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Attendance Report Card */}
          <Card>
            <CardHeader>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mb-2">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <CardTitle className="text-base">Employee Attendance Report</CardTitle>
              <CardDescription className="text-xs">
                Includes punch-in, punch-out, recorded duration, daily status, and correction source.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={attStartDate}
                    onChange={(e) => setAttStartDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={attEndDate}
                    onChange={(e) => setAttEndDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleExportAttendance('xlsx')}
                  isLoading={isDownloading}
                  icon={<FileSpreadsheet className="w-4 h-4" />}
                  className="flex-1"
                >
                  Download Excel (.xlsx)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportAttendance('csv')}
                  isLoading={isDownloading}
                  icon={<FileText className="w-4 h-4" />}
                  className="flex-1"
                >
                  Download CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Task Time Entries Report Card */}
          <Card>
            <CardHeader>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center mb-2">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <CardTitle className="text-base">Task Time-Log Report</CardTitle>
              <CardDescription className="text-xs">
                Detailed deliverables, duration breakdown, and backdating explanation notes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={taskStartDate}
                    onChange={(e) => setTaskStartDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={taskEndDate}
                    onChange={(e) => setTaskEndDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleExportTime('xlsx')}
                  isLoading={isDownloading}
                  icon={<FileSpreadsheet className="w-4 h-4" />}
                  className="flex-1"
                >
                  Download Excel (.xlsx)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportTime('csv')}
                  isLoading={isDownloading}
                  icon={<FileText className="w-4 h-4" />}
                  className="flex-1"
                >
                  Download CSV
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

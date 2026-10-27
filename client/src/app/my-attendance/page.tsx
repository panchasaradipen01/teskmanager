'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { formatMinutes, formatDateDisplay, formatTimeDisplay } from '@/lib/utils';
import {
  Clock,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  FileText,
  CalendarDays,
} from 'lucide-react';

export default function MyAttendancePage() {
  const [records, setRecords] = useState<any[]>([]);
  const [corrections, setCorrections] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Correction Request Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetDate, setTargetDate] = useState('');
  const [requestedIn, setRequestedIn] = useState('09:00');
  const [requestedOut, setRequestedOut] = useState('18:00');
  const [reason, setReason] = useState('');
  const [todayMax, setTodayMax] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setTodayMax(new Date().toISOString().split('T')[0]);
  }, []);

  const fetchAttendance = useCallback(async () => {
    setIsLoading(true);
    try {
      const [attRes, corrRes] = await Promise.all([
        api.get('/attendance', { page: currentPage, limit: 10 }),
        api.get('/attendance/corrections', { limit: 10 }),
      ]);
      setRecords(attRes.data || []);
      setCorrections(corrRes.data || []);
      if (attRes.meta) {
        setTotalPages(attRes.meta.totalPages);
        setTotalRecords(attRes.meta.total);
      }
    } catch (err: any) {
      console.error('Failed to load attendance:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const handleSubmitCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    try {
      const punchInIso = new Date(`${targetDate}T${requestedIn}:00Z`).toISOString();
      const punchOutIso = new Date(`${targetDate}T${requestedOut}:00Z`).toISOString();

      await api.post('/attendance/corrections', {
        targetDate,
        requestedPunchInAt: punchInIso,
        requestedPunchOutAt: punchOutIso,
        reason,
      });

      setFeedback({
        type: 'success',
        text: 'Attendance correction request submitted for admin review.',
      });
      setIsModalOpen(false);
      setTargetDate('');
      setReason('');
      await fetchAttendance();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Submission failed' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const attendanceColumns: Column<any>[] = [
    {
      header: 'Date',
      cell: (row) => (
        <span className="font-semibold text-slate-900 dark:text-slate-100">
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
          {row.punchOutAt ? formatTimeDisplay(row.punchOutAt) : (
            <Badge variant="warning" className="text-[10px]">Missing Punch-out</Badge>
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
          {row.source === 'CORRECTION' ? 'Correction Flow' : 'Web Punch'}
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
              My Attendance Records
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Complete history of daily punch-ins, punch-outs, and correction requests.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsModalOpen(true)}
              icon={<PlusCircle className="w-4 h-4" />}
            >
              Request Attendance Correction
            </Button>
          </div>
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

        {/* Primary Attendance Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Punch History</CardTitle>
            <CardDescription className="text-xs">
              Daily recorded attendance logs in Asia/Kolkata timezone.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              columns={attendanceColumns}
              data={records}
              isLoading={isLoading}
              emptyMessage="No attendance sessions recorded yet."
            />
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalRecords={totalRecords}
              limit={10}
              onPageChange={setCurrentPage}
            />
          </CardContent>
        </Card>

        {/* Correction Requests Section */}
        {corrections.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Correction Request History</CardTitle>
              <CardDescription className="text-xs">
                Status of your submitted previous-day attendance adjustments.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold uppercase">
                    <tr>
                      <th className="p-3">Target Date</th>
                      <th className="p-3">Requested Hours</th>
                      <th className="p-3">Reason</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Admin Review</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {corrections.map((corr) => (
                      <tr key={corr._id}>
                        <td className="p-3 font-semibold">{corr.targetDate}</td>
                        <td className="p-3">
                          {formatTimeDisplay(corr.requestedPunchInAt)} –{' '}
                          {formatTimeDisplay(corr.requestedPunchOutAt)}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                          {corr.reason}
                        </td>
                        <td className="p-3">
                          <Badge
                            variant={
                              corr.status === 'APPROVED'
                                ? 'success'
                                : corr.status === 'REJECTED'
                                ? 'danger'
                                : 'warning'
                            }
                          >
                            {corr.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-slate-500">
                          {corr.reviewComment || 'Pending evaluation'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Submit Correction Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Submit Attendance Correction"
        description="Submit previous-day missed punch-in or punch-out with a mandatory explanation."
      >
        <form onSubmit={handleSubmitCorrection} className="space-y-4">
          <Input
            label="Target Date (YYYY-MM-DD)"
            type="date"
            max={todayMax}
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            helperText="Cannot select future dates."
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Requested Punch In"
              type="time"
              value={requestedIn}
              onChange={(e) => setRequestedIn(e.target.value)}
              required
            />
            <Input
              label="Requested Punch Out"
              type="time"
              value={requestedOut}
              onChange={(e) => setRequestedOut(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Mandatory Reason / Justification
            </label>
            <textarea
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              rows={3}
              placeholder="Explain the circumstance (e.g. system timeout, field client visit, electricity outage)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              minLength={5}
              required
            />
            <p className="text-[11px] text-slate-400">
              Must be at least 5 characters long and will be archived in the permanent audit trail.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              Submit for Admin Review
            </Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}

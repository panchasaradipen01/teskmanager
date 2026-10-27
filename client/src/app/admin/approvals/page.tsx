'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { formatTimeDisplay, formatDateDisplay } from '@/lib/utils';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  MessageSquare,
  ShieldAlert,
} from 'lucide-react';

export default function AttendanceApprovalsPage() {
  const [corrections, setCorrections] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Review Modal
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [selectedCorrection, setSelectedCorrection] = useState<any>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchCorrections = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/attendance/corrections', {
        page: currentPage,
        limit: 10,
        status: statusFilter || undefined,
      });
      setCorrections(res.data || []);
      if (res.meta) {
        setTotalPages(res.meta.totalPages);
        setTotalRecords(res.meta.total);
      }
    } catch (err: any) {
      console.error('Failed to load corrections:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, statusFilter]);

  useEffect(() => {
    fetchCorrections();
  }, [fetchCorrections]);

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCorrection) return;
    setIsSubmitting(true);
    setFeedback(null);

    try {
      await api.patch(`/attendance/corrections/${selectedCorrection._id}/review`, {
        status: reviewAction,
        reviewComment,
      });

      setFeedback({
        type: 'success',
        text: `Correction request has been ${reviewAction.toLowerCase()} successfully.`,
      });
      setIsReviewOpen(false);
      setReviewComment('');
      await fetchCorrections();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Review submission failed' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openReviewModal = (corr: any, action: 'APPROVED' | 'REJECTED') => {
    setSelectedCorrection(corr);
    setReviewAction(action);
    setReviewComment('');
    setIsReviewOpen(true);
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
      header: 'Target Date',
      cell: (row) => (
        <span className="font-semibold text-slate-800 dark:text-slate-200">
          {formatDateDisplay(row.targetDate)}
        </span>
      ),
    },
    {
      header: 'Requested Time',
      cell: (row) => (
        <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
          {formatTimeDisplay(row.requestedPunchInAt)} – {formatTimeDisplay(row.requestedPunchOutAt)}
        </span>
      ),
    },
    {
      header: 'Mandatory Reason',
      cell: (row) => (
        <span className="text-xs text-slate-600 dark:text-slate-300 max-w-xs block truncate" title={row.reason}>
          {row.reason}
        </span>
      ),
    },
    {
      header: 'Status',
      cell: (row) => (
        <Badge
          variant={
            row.status === 'APPROVED'
              ? 'success'
              : row.status === 'REJECTED'
              ? 'danger'
              : 'warning'
          }
        >
          {row.status}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      cell: (row) => (
        row.status === 'PENDING' ? (
          <div className="flex items-center gap-2">
            <Button
              variant="success"
              size="sm"
              onClick={() => openReviewModal(row, 'APPROVED')}
              icon={<CheckCircle2 className="w-3.5 h-3.5" />}
              className="text-xs py-1"
            >
              Approve
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => openReviewModal(row, 'REJECTED')}
              icon={<XCircle className="w-3.5 h-3.5" />}
              className="text-xs py-1"
            >
              Reject
            </Button>
          </div>
        ) : (
          <span className="text-xs text-slate-400">
            Reviewed by {row.reviewedBy?.name || 'Admin'}
          </span>
        )
      ),
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Attendance Correction Requests
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Review and approve previous-day missed punches and adjustments submitted by employees.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              <option value="PENDING">Pending Review Only</option>
              <option value="APPROVED">Approved History</option>
              <option value="REJECTED">Rejected History</option>
              <option value="">All Requests</option>
            </select>
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
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>{feedback.text}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="text-xs font-bold hover:underline">
              Dismiss
            </button>
          </div>
        )}

        <Card>
          <CardContent className="p-0">
            <DataTable
              columns={columns}
              data={corrections}
              isLoading={isLoading}
              emptyMessage="No correction requests pending approval."
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
      </div>

      {/* Review Modal */}
      <Modal
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        title={`${reviewAction === 'APPROVED' ? 'Approve' : 'Reject'} Attendance Correction`}
        description={`Request for ${selectedCorrection?.userId?.name} on ${selectedCorrection?.targetDate}`}
      >
        <form onSubmit={handleReviewSubmit} className="space-y-4">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
            <div>
              <span className="text-slate-400 block">Requested Punch Times:</span>
              <strong className="text-slate-800 dark:text-slate-200">
                {formatTimeDisplay(selectedCorrection?.requestedPunchInAt)} –{' '}
                {formatTimeDisplay(selectedCorrection?.requestedPunchOutAt)}
              </strong>
            </div>
            <div>
              <span className="text-slate-400 block">Employee Explanation Note:</span>
              <p className="text-slate-700 dark:text-slate-300 italic mt-0.5">
                &ldquo;{selectedCorrection?.reason}&rdquo;
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Admin Review Comments
            </label>
            <textarea
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              rows={3}
              placeholder="Provide comments or audit rationale for this decision..."
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsReviewOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={reviewAction === 'APPROVED' ? 'success' : 'danger'}
              type="submit"
              isLoading={isSubmitting}
            >
              Confirm {reviewAction === 'APPROVED' ? 'Approval' : 'Rejection'}
            </Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}

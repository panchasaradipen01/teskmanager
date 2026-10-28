import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, CheckCircle2, AlertCircle, FileText, Lock } from 'lucide-react';
import { Button } from './Button';
import { Modal } from './Modal';
import { Badge } from './Badge';
import { formatMinutes, formatTimeDisplay } from '@/lib/utils';

export interface CalendarDayData {
  date: string; // YYYY-MM-DD
  attendance?: any;
  timeEntries?: any[];
  hasPendingCorrection?: boolean;
  totalTaskMinutes: number;
}

interface CalendarViewProps {
  currentMonth: string; // YYYY-MM
  daysData: CalendarDayData[];
  onMonthChange: (month: string) => void;
  isLoading?: boolean;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  currentMonth,
  daysData,
  onMonthChange,
  isLoading = false,
}) => {
  const [selectedDay, setSelectedDay] = useState<CalendarDayData | null>(null);
  const [todayStr, setTodayStr] = useState('');
  const [yesterdayStr, setYesterdayStr] = useState('');

  React.useEffect(() => {
    const now = new Date();
    const t = now.toISOString().split('T')[0];
    const y = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setTodayStr(t);
    setYesterdayStr(y);
  }, []);

  const [dateInfo, setDateInfo] = useState<{
    startingDayIndex: number;
    totalDays: number;
    monthLabel: string;
    year: number;
    month: number;
  }>({
    startingDayIndex: 0,
    totalDays: 31,
    monthLabel: 'Current Month',
    year: 2026,
    month: 10,
  });

  React.useEffect(() => {
    if (!currentMonth) return;
    const [y, m] = currentMonth.split('-').map(Number);
    const firstDay = new Date(y, m - 1, 1);
    const lastDay = new Date(y, m, 0);
    setDateInfo({
      startingDayIndex: firstDay.getDay(),
      totalDays: lastDay.getDate(),
      monthLabel: firstDay.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      }),
      year: y,
      month: m,
    });
  }, [currentMonth]);

  const handlePrevMonth = () => {
    const prevDate = new Date(dateInfo.year, dateInfo.month - 2, 1);
    const mStr = String(prevDate.getMonth() + 1).padStart(2, '0');
    onMonthChange(`${prevDate.getFullYear()}-${mStr}`);
  };

  const handleNextMonth = () => {
    const nextDate = new Date(dateInfo.year, dateInfo.month, 1);
    const mStr = String(nextDate.getMonth() + 1).padStart(2, '0');
    onMonthChange(`${nextDate.getFullYear()}-${mStr}`);
  };

  // Map day data by date string
  const dayMap = new Map<string, CalendarDayData>();
  daysData.forEach((d) => dayMap.set(d.date, d));

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-6">
      {/* Calendar Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {dateInfo.monthLabel}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Click on any active calendar day to inspect detailed attendance and task logs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrevMonth} icon={<ChevronLeft className="w-4 h-4" />}>
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const now = new Date();
              const mStr = String(now.getMonth() + 1).padStart(2, '0');
              onMonthChange(`${now.getFullYear()}-${mStr}`);
            }}
          >
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={handleNextMonth} icon={<ChevronRight className="w-4 h-4" />}>
            Next
          </Button>
        </div>
      </div>

      {/* Days of week header */}
      <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {weekDays.map((wd) => (
          <div key={wd} className="py-1">
            {wd}
          </div>
        ))}
      </div>

      {/* Grid of days */}
      <div className="grid grid-cols-7 gap-2">
        {/* Leading empty cells */}
        {[...Array(dateInfo.startingDayIndex)].map((_, i) => (
          <div key={`empty-${i}`} className="min-h-[90px] rounded-lg bg-slate-50/50 dark:bg-slate-800/20 border border-transparent" />
        ))}

        {/* Month days */}
        {[...Array(dateInfo.totalDays)].map((_, i) => {
          const dayNum = i + 1;
          const dateStr = `${dateInfo.year}-${String(dateInfo.month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
          const dayInfo = dayMap.get(dateStr);
          const att = dayInfo?.attendance;
          const taskMins = dayInfo?.totalTaskMinutes || 0;
          const attMins = att?.durationMinutes || 0;
          const hasCorrection = dayInfo?.hasPendingCorrection;

          const isOverlogged = taskMins > attMins + 15 && attMins > 0;
          const isPastLocked = yesterdayStr ? dateStr < yesterdayStr : false;
          const isToday = dateStr === todayStr;

          return (
            <div
              key={dateStr}
              onClick={() => dayInfo && setSelectedDay(dayInfo)}
              className={`min-h-[95px] p-2 rounded-lg border transition-all select-none flex flex-col justify-between ${
                dayInfo
                  ? 'cursor-pointer border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-xs bg-white dark:bg-slate-900'
                  : isPastLocked
                  ? 'border-slate-100 dark:border-slate-800/30 bg-slate-50/20 dark:bg-slate-900/20 opacity-60 cursor-default'
                  : 'border-slate-100 dark:border-slate-800/40 bg-slate-50/30 dark:bg-slate-900/40 text-slate-400 cursor-default'
              } ${isToday ? 'ring-2 ring-indigo-500/50' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold ${isToday ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-slate-700 dark:text-slate-300'}`}>
                  {dayNum}
                </span>
                <div className="flex items-center gap-1">
                  {isPastLocked && (
                    <span title="Past date locked for edits">
                      <Lock className="w-2.5 h-2.5 text-slate-400 dark:text-slate-600" />
                    </span>
                  )}
                  {hasCorrection && (
                    <span className="w-2 h-2 rounded-full bg-amber-500" title="Pending correction" />
                  )}
                </div>
              </div>

              {att && (
                <div className="my-1 space-y-1">
                  <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    <Clock className="w-3 h-3 shrink-0" />
                    <span>{formatMinutes(attMins)}</span>
                  </div>

                  {taskMins > 0 && (
                    <div className={`flex items-center gap-1 text-[11px] font-medium ${isOverlogged ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-indigo-600 dark:text-indigo-400'}`}>
                      <FileText className="w-3 h-3 shrink-0" />
                      <span>{formatMinutes(taskMins)}</span>
                    </div>
                  )}
                </div>
              )}

              {att && (
                <div className="mt-auto">
                  <Badge
                    variant={att.status === 'PRESENT' ? 'success' : att.status === 'HALF_DAY' ? 'warning' : 'default'}
                    className="text-[10px] py-0 px-1.5"
                  >
                    {att.status}
                  </Badge>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Drill-down Modal */}
      {selectedDay && (
        <Modal
          isOpen={!!selectedDay}
          onClose={() => setSelectedDay(null)}
          title={`Activity Details — ${selectedDay.date}`}
          maxWidth="lg"
        >
          <div className="space-y-4">
            {yesterdayStr && selectedDay.date < yesterdayStr && (
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Historical record (locked): Direct time entry and punch adjustments are permitted only for today and yesterday.</span>
              </div>
            )}

            {/* Attendance Section */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Attendance Session
              </h4>
              {selectedDay.attendance ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-slate-400 block">Punch In</span>
                    <strong className="text-slate-800 dark:text-slate-200">
                      {formatTimeDisplay(selectedDay.attendance.punchInAt)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Punch Out</span>
                    <strong className="text-slate-800 dark:text-slate-200">
                      {formatTimeDisplay(selectedDay.attendance.punchOutAt)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Total Duration</span>
                    <strong className="text-emerald-600 dark:text-emerald-400">
                      {formatMinutes(selectedDay.attendance.durationMinutes)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Status</span>
                    <Badge variant="success">{selectedDay.attendance.status}</Badge>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">No attendance recorded for this date.</p>
              )}
            </div>

            {/* Task Time Entries Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Tasks Worked ({selectedDay.timeEntries?.length || 0})
                </h4>
                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  Total Logged: {formatMinutes(selectedDay.totalTaskMinutes)}
                </span>
              </div>

              {selectedDay.timeEntries && selectedDay.timeEntries.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {selectedDay.timeEntries.map((te: any) => (
                    <div
                      key={te._id}
                      className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <strong className="text-slate-900 dark:text-slate-100">
                          {te.taskId?.title || 'General Task'}
                        </strong>
                        <Badge variant="primary">{formatMinutes(te.durationMinutes)}</Badge>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        {te.description}
                      </p>
                      {te.backdateReason && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 italic">
                          Note: {te.backdateReason}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No task time entries recorded for this date.</p>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

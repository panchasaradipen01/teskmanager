'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { CalendarView, CalendarDayData } from '@/components/ui/CalendarView';
import { api } from '@/lib/api';

export default function MyCalendarPage() {
  const [currentMonth, setCurrentMonth] = useState('2026-10');
  const [daysData, setDaysData] = useState<CalendarDayData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const d = new Date();
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }, []);

  const fetchCalendar = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/dashboard/calendar', { month: currentMonth });
      setDaysData(res.data?.days || []);
    } catch (err: any) {
      console.error('Failed to load calendar data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentMonth]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            My Work Calendar
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Visual month overview of your daily attendance, recorded tasks, and time distribution.
          </p>
        </div>

        <CalendarView
          currentMonth={currentMonth}
          daysData={daysData}
          onMonthChange={setCurrentMonth}
          isLoading={isLoading}
        />
      </div>
    </AppLayout>
  );
}

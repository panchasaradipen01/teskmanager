import { toZonedTime, format as formatTz } from 'date-fns-tz';
import { differenceInMinutes, parseISO, isValid } from 'date-fns';
import { ENV } from '../config/env.js';

export const getTimezone = (): string => ENV.DEFAULT_TIMEZONE;

/**
 * Returns current Date in UTC
 */
export const nowUtc = (): Date => new Date();

/**
 * Get date string formatted as YYYY-MM-DD in the target business timezone
 */
export const getZonedDateString = (date: Date | string = new Date(), tz: string = getTimezone()): string => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return '';
  const zoned = toZonedTime(d, tz);
  return formatTz(zoned, 'yyyy-MM-dd', { timeZone: tz });
};

/**
 * Get current business date string (YYYY-MM-DD) in Asia/Kolkata
 */
export const getTodayDateString = (tz: string = getTimezone()): string => {
  return getZonedDateString(new Date(), tz);
};

/**
 * Get yesterday's business date string (YYYY-MM-DD) in Asia/Kolkata
 */
export const getYesterdayDateString = (tz: string = getTimezone()): string => {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return getZonedDateString(yesterday, tz);
};

/**
 * Checks if a date string (YYYY-MM-DD) is in the future relative to business today
 */
export const isFutureDateString = (dateStr: string, tz: string = getTimezone()): boolean => {
  const today = getTodayDateString(tz);
  return dateStr > today;
};

/**
 * Calculate duration in minutes between two dates
 */
export const calcDurationMinutes = (start: Date, end: Date): number => {
  if (!start || !end) return 0;
  const diff = differenceInMinutes(end, start);
  return diff > 0 ? diff : 0;
};

/**
 * Format minutes into "Xh Ym"
 */
export const formatMinutesToDisplay = (totalMinutes: number): string => {
  if (!totalMinutes || totalMinutes <= 0) return '0h 0m';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  return `${hours}h ${minutes}m`;
};

/**
 * Utilities for parsing and formatting human work duration:
 * Supported formats:
 * - "1h 0m"
 * - "1d 1h 10m"
 * - "1w 1d 1h 10m"
 * - "45m", "2.5h", "90"
 * Standard work tracking convention: 1w = 5 days (40h), 1d = 8 hours, 1h = 60m.
 */

export function parseDurationString(input: string | number): number {
  if (typeof input === 'number') return Math.max(0, Math.round(input));
  if (!input || typeof input !== 'string') return 0;

  const trimmed = input.trim();
  if (!trimmed) return 0;

  // Pure numeric input like "60" or "90"
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Math.max(0, Math.round(parseFloat(trimmed)));
  }

  const regex = /(\d+(?:\.\d+)?)\s*([wdhm])/gi;
  let totalMinutes = 0;
  let match: RegExpExecArray | null;
  let foundAny = false;

  while ((match = regex.exec(trimmed)) !== null) {
    foundAny = true;
    const value = parseFloat(match[1]);
    const unit = match[2].toLowerCase();

    if (unit === 'w') {
      totalMinutes += value * 5 * 8 * 60; // 1w = 40 hours = 2400 mins
    } else if (unit === 'd') {
      totalMinutes += value * 8 * 60; // 1d = 8 hours = 480 mins
    } else if (unit === 'h') {
      totalMinutes += value * 60; // 1h = 60 mins
    } else if (unit === 'm') {
      totalMinutes += value;
    }
  }

  return foundAny ? Math.round(totalMinutes) : 0;
}

export function formatHumanDuration(totalMinutes: number): string {
  if (!totalMinutes || totalMinutes <= 0) return '0h 0m';

  const mins = Math.round(totalMinutes);
  const minutesPerWeek = 5 * 8 * 60; // 2400 mins
  const minutesPerDay = 8 * 60; // 480 mins
  const minutesPerHour = 60;

  const weeks = Math.floor(mins / minutesPerWeek);
  let remainder = mins % minutesPerWeek;

  const days = Math.floor(remainder / minutesPerDay);
  remainder = remainder % minutesPerDay;

  const hours = Math.floor(remainder / minutesPerHour);
  const minutes = remainder % minutesPerHour;

  const parts: string[] = [];
  if (weeks > 0) parts.push(`${weeks}w`);
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || (weeks === 0 && days === 0)) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);

  return parts.join(' ');
}

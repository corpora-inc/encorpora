import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isToday, addDays, subDays } from 'date-fns';

/**
 * Get today's date as YYYY-MM-DD string in local timezone
 */
export function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse a YYYY-MM-DD string as a local date (not UTC)
 */
export function stringToDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Convert a Date object to YYYY-MM-DD string in local timezone
 */
export function dateToString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format a date using date-fns
 */
export function formatDate(date: Date | string, formatStr: string = 'yyyy-MM-dd'): string {
  if (typeof date === 'string') {
    return format(stringToDate(date), formatStr);
  }
  return format(date, formatStr);
}

/**
 * Add days to a date string
 */
export function addDaysToString(dateStr: string, days: number): string {
  const date = stringToDate(dateStr);
  const newDate = addDays(date, days);
  return dateToString(newDate);
}

/**
 * Subtract days from a date string
 */
export function subDaysFromString(dateStr: string, days: number): string {
  const date = stringToDate(dateStr);
  const newDate = subDays(date, days);
  return dateToString(newDate);
}

export function getMonthCalendarDays(year: number, month: number): Date[] {
  const date = new Date(year, month - 1, 1);
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
}

export function isDateInMonth(date: Date, month: number, year: number): boolean {
  return isSameMonth(date, new Date(year, month - 1, 1));
}

export function isDateToday(date: Date): boolean {
  return isToday(date);
}

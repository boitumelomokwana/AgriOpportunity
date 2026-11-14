const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const LONG_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function startOfDay(value: string | Date): Date {
  const date = toDate(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(value: string | Date, days: number): Date {
  const date = startOfDay(value);
  date.setDate(date.getDate() + days);
  return date;
}

export function daysFromNow(days: number): string {
  const date = addDays(new Date(), days);
  return date.toISOString();
}

export function daysUntil(value: string): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return Number.POSITIVE_INFINITY;
  const diff = startOfDay(parsed).getTime() - startOfDay(new Date()).getTime();
  return Math.round(diff / 86_400_000);
}

export function formatShortDate(value: string | Date): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getDate().toString().padStart(2, '0')} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatRelativeTime(value: string | Date): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return '';
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return formatShortDate(date);
}

export function formatDayMonth(value: string | Date): string {
  const date = toDate(value);
  return `${date.getDate().toString().padStart(2, '0')} ${MONTHS[date.getMonth()].toUpperCase()}`;
}

export function formatLongDate(value: string | Date = new Date()): string {
  const date = toDate(value);
  return `${DAYS[date.getDay()]}, ${date.getDate()} ${LONG_MONTHS[date.getMonth()]}`;
}

export function formatTime(value: Date = new Date()): string {
  const hours = value.getHours().toString().padStart(2, '0');
  const minutes = value.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function isPast(value: string): boolean {
  return daysUntil(value) < 0;
}

export function isWithinDays(value: string, days: number): boolean {
  const remaining = daysUntil(value);
  return remaining >= 0 && remaining <= days;
}

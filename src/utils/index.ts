import { formatDistanceToNow, format, parseISO, isValid } from 'date-fns';

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  return isValid(parsedDate) ? format(parsedDate, 'MMM d, yyyy') : '-';
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  return isValid(parsedDate) ? format(parsedDate, 'MMM d, yyyy h:mm a') : '-';
}

export function formatTime(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  return isValid(parsedDate) ? format(parsedDate, 'h:mm a') : '-';
}

export function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  return isValid(parsedDate) ? formatDistanceToNow(parsedDate, { addSuffix: true }) : '-';
}

export function formatCurrency(amount: number | null | undefined, currency = 'ZAR'): string {
  if (amount === null || amount === undefined) return '-';
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return '-';
  return new Intl.NumberFormat('en-ZA').format(num);
}

export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function titleCase(str: string): string {
  if (!str) return '';
  return str.replace(/_/g, ' ').split(' ').map(capitalize).join(' ');
}

export function truncate(str: string, maxLength: number): string {
  if (!str || str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

export function getInitials(name: string): string {
  if (!name) return 'U';
  return name
    .split(' ')
    .map((n) => n.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'HH:mm');
}

export function truncateWithSingleDot(text: string, maxLength: number = 30): string {
  if (!text || text.length <= maxLength) {
    return text || '';
  }
  // Truncate the text and add a single dot instead of three dots
  return text.substring(0, maxLength) + '.';
}

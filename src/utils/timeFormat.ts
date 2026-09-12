/**
 * Canonical 12-hour time formatter for Repeato.
 * Ensures all time displays (task reminder time, completion timestamp, history, etc.)
 * consistently follow a single 12-hour AM/PM format (e.g., "9:00 AM", "2:30 PM").
 */

export function formatTime12(
  timeOrDate: string | Date | null | undefined,
  fallback = '9:00 AM'
): string {
  if (!timeOrDate) return fallback;

  try {
    // 1. If it's a Date object
    if (timeOrDate instanceof Date) {
      if (isNaN(timeOrDate.getTime())) return fallback;
      return timeOrDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    }

    const str = String(timeOrDate).trim();
    if (!str) return fallback;

    // 2. If it's an ISO date string (contains 'T' or looks like YYYY-MM-DD)
    if (str.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(str)) {
      const parsedDate = new Date(str);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
      }
    }

    // 3. If it's an "HH:mm" or "HH:mm:ss" 24-hour time string
    const match = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (match) {
      const hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
        const d = new Date();
        d.setHours(hours, minutes, 0, 0);
        return d.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
      }
    }

    // 4. If already contains AM/PM
    const ampmMatch = str.match(/^(\d{1,2}):(\d{2})\s*([ap]m)$/i);
    if (ampmMatch) {
      let hours = parseInt(ampmMatch[1], 10);
      const minutes = parseInt(ampmMatch[2], 10);
      const isPm = ampmMatch[3].toUpperCase() === 'PM';
      if (isPm && hours < 12) hours += 12;
      if (!isPm && hours === 12) hours = 0;
      const d = new Date();
      d.setHours(hours, minutes, 0, 0);
      return d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    }

    return str;
  } catch {
    return fallback;
  }
}

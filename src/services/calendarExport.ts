import { Platform, Share } from 'react-native';
import type { RepeatingTask } from '@/types';

export function generateCalendarIcs(tasks: RepeatingTask[]): string {
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Repeato//Task Calendar//EN',
    'CALSCALE:GREGORIAN',
  ];

  tasks.forEach((t) => {
    const dtstart = new Date(t.nextDueDate);
    dtstart.setHours(9, 0, 0, 0); // Default to 9 AM
    if (t.reminderTime) {
      const parts = t.reminderTime.split(':');
      dtstart.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
    }
    const dtend = new Date(dtstart.getTime() + 30 * 60000); // 30 min event

    const formatIcsDate = (d: Date) => {
      return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    ics.push('BEGIN:VEVENT');
    ics.push(`UID:${t.id}@repeato.app`);
    ics.push(`DTSTAMP:${formatIcsDate(new Date())}`);
    ics.push(`DTSTART:${formatIcsDate(dtstart)}`);
    ics.push(`DTEND:${formatIcsDate(dtend)}`);
    ics.push(`SUMMARY:${t.title}`);
    ics.push(`DESCRIPTION:Reminder for repeating task: ${t.title} (${t.frequencyLabel})`);

    const type = t.recurrence.type;
    if (type === 'daily') {
      ics.push('RRULE:FREQ=DAILY');
    } else if (type === 'weekly') {
      ics.push('RRULE:FREQ=WEEKLY');
    } else if (type === 'monthly') {
      ics.push('RRULE:FREQ=MONTHLY');
    }
    ics.push('END:VEVENT');
  });

  ics.push('END:VCALENDAR');
  return ics.join('\r\n');
}

export async function exportCalendar(tasks: RepeatingTask[]): Promise<boolean> {
  const icsContent = generateCalendarIcs(tasks);

  if (Platform.OS === 'web') {
    try {
      const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', 'repeato-tasks.ics');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return true;
    } catch {
      return false;
    }
  } else {
    try {
      await Share.share({
        message: icsContent,
        title: 'repeato-tasks.ics',
      });
      return true;
    } catch {
      return false;
    }
  }
}

import { describe, expect, it, vi } from 'vitest';
import { exportCalendar, generateCalendarIcs } from '@/services/calendarExport';
import { createTaskFromPreset } from '@/domain/task';
import { Share } from 'react-native';

vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Share: { share: vi.fn().mockResolvedValue({ action: 'sharedAction' }) },
}));

describe('services/calendarExport', () => {
  it('generateCalendarIcs produces valid ICS string', () => {
    const task = createTaskFromPreset('Rent', 'home', 'Monthly');
    const ics = generateCalendarIcs([task]);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('SUMMARY:Rent');
    expect(ics).toContain('END:VCALENDAR');
  });

  it('exportCalendar shares content on native platforms', async () => {
    const task = createTaskFromPreset('Rent', 'home', 'Monthly');
    const success = await exportCalendar([task]);
    expect(success).toBe(true);
    expect(Share.share).toHaveBeenCalled();
  });
});

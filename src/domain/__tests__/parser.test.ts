import { describe, expect, it } from 'vitest';
import { parseTaskInput } from '@/domain/parser';

describe('parseTaskInput natural language engine', () => {
  describe('Legacy & standard formats', () => {
    it('parses English inputs with 12-hour AM/PM time and amounts', () => {
      const result = parseTaskInput('Pay maid every month ₹3,500 at 9am');
      expect(result.title).toBe('Pay maid');
      expect(result.amount).toBe(3500);
      expect(result.reminderTime).toBe('09:00');
      expect(result.category).toBe('help');
    });

    it('parses English inputs with PM times and cleans title', () => {
      const result = parseTaskInput('Netflix subscription every month ₹199 at 7:30 pm');
      expect(result.title).toBe('Netflix subscription');
      expect(result.amount).toBe(199);
      expect(result.reminderTime).toBe('19:30');
      expect(result.category).toBe('subs');
    });

    it('parses English 24-hour time', () => {
      const result = parseTaskInput('Check car engine every 15 days at 18:00');
      expect(result.title).toBe('Check car engine');
      expect(result.reminderTime).toBe('18:00');
      expect(result.category).toBe('vehicle');
    });
  });

  describe('Flexible amount recognition', () => {
    it('parses plain numbers without currency symbols', () => {
      const result = parseTaskInput('House rent 15000 monthly on 5th');
      expect(result.title).toBe('House rent');
      expect(result.amount).toBe(15000);
      expect(result.recurrence).toEqual({ type: 'monthDay', dayOfMonth: 5 });
    });

    it('parses 15k and decimal thousands notation (2.5k)', () => {
      const res1 = parseTaskInput('Gym membership 15k yearly');
      expect(res1.amount).toBe(15000);
      expect(res1.recurrence).toEqual({ type: 'yearly' });

      const res2 = parseTaskInput('Electric bill 2.5k monthly');
      expect(res2.amount).toBe(2500);
    });

    it('parses rs and inr suffixes', () => {
      const result = parseTaskInput('Cook salary 5000 rs every month');
      expect(result.amount).toBe(5000);
      expect(result.title).toBe('Cook salary');
    });
  });

  describe('Time recognition without "at"', () => {
    it('parses 7am without requiring "at"', () => {
      const result = parseTaskInput('Gym daily 7am');
      expect(result.title).toBe('Gym');
      expect(result.reminderTime).toBe('07:00');
      expect(result.recurrence).toEqual({ type: 'daily' });
    });

    it('parses 9:30 pm without requiring "at"', () => {
      const result = parseTaskInput('Water plants daily 9:30 pm');
      expect(result.reminderTime).toBe('21:30');
    });
  });

  describe('Multi-dose parsing for medicines', () => {
    it('parses "twice daily" and sets 2 doses with defaults', () => {
      const result = parseTaskInput('Blood pressure medicine twice daily at 8am');
      expect(result.title).toBe('Blood pressure medicine');
      expect(result.isMultiTime).toBe(true);
      expect(result.timesPerDay).toBe(2);
      expect(result.category).toBe('health');
      expect(result.icon).toBe('💊');
      expect(result.reminderTimes?.length).toBe(2);
    });

    it('parses "3 times a day" and multiple times', () => {
      const result = parseTaskInput('Antibiotic 3 times a day at 8am and 8pm');
      expect(result.isMultiTime).toBe(true);
      expect(result.timesPerDay).toBe(3);
      expect(result.reminderTimes?.length).toBe(3);
    });

    it('parses Hindi "दिन में 2 बार"', () => {
      const result = parseTaskInput('दवा खाना दिन में 2 बार सुबह 8 बजे', 'hi');
      expect(result.title).toBe('दवा खाना');
      expect(result.isMultiTime).toBe(true);
      expect(result.timesPerDay).toBe(2);
      expect(result.category).toBe('health');
    });
  });

  describe('Recurrence & ordinal date parsing', () => {
    it('parses "monthly on 5th" to monthDay 5', () => {
      const result = parseTaskInput('House rent 15000 monthly on 5th');
      expect(result.recurrence).toEqual({ type: 'monthDay', dayOfMonth: 5 });
    });

    it('parses "every 2 months" to interval months', () => {
      const result = parseTaskInput('Water bill 500 every 2 months');
      expect(result.amount).toBe(500);
      expect(result.recurrence).toEqual({ type: 'interval', interval: 2, intervalUnit: 'months' });
    });

    it('parses "every sunday" to weekly on day 0', () => {
      const result = parseTaskInput('Clean car every sunday at 10am');
      expect(result.title).toBe('Clean car');
      expect(result.recurrence).toEqual({ type: 'weekly', weekday: 0 });
      expect(result.reminderTime).toBe('10:00');
    });
  });

  describe('Hindi natural language parsing', () => {
    it('parses Hindi inputs with period (सुबह/शाम) and time', () => {
      const result = parseTaskInput('दवा खाना हर दिन सुबह 8 बजे', 'hi');
      expect(result.title).toBe('दवा खाना');
      expect(result.reminderTime).toBe('08:00');
      expect(result.category).toBe('health');
    });

    it('parses Hindi inputs with PM times and amounts', () => {
      const result = parseTaskInput('दूध का बिल हर महीने ₹1,200 शाम 7:30 बजे', 'hi');
      expect(result.title).toBe('दूध का बिल');
      expect(result.amount).toBe(1200);
      expect(result.reminderTime).toBe('19:30');
      expect(result.category).toBe('supplies');
    });

    it('parses Hindi date and amount: "किराया 15000 हर महीने 5 तारीख"', () => {
      const result = parseTaskInput('किराया 15000 हर महीने 5 तारीख', 'hi');
      expect(result.amount).toBe(15000);
      expect(result.recurrence).toEqual({ type: 'monthDay', dayOfMonth: 5 });
      expect(result.category).toBe('bills');
    });
  });

  describe('Detected tokens metadata', () => {
    it('returns tokens for amount, time, recurrence, and category', () => {
      const result = parseTaskInput('Rent 15000 monthly on 5th at 9am');
      expect(result.detectedTokens).toBeDefined();
      const ids = result.detectedTokens?.map((t) => t.id);
      expect(ids).toContain('amount');
      expect(ids).toContain('recurrence');
      expect(ids).toContain('time');
      expect(ids).toContain('category');
    });
  });

  describe('Intelligent habit defaults & Hinglish conversational parsing', () => {
    it('intelligently defaults "Water plants" to gardening category, 🪴 icon, and daily recurrence', () => {
      const result = parseTaskInput('Water plants');
      expect(result.title).toBe('Water plants');
      expect(result.category).toBe('gardening');
      expect(result.icon).toBe('🪴');
      expect(result.recurrence).toEqual({ type: 'daily' });
    });

    it('intelligently defaults "Gym workout" to health category, 💪 icon, and daily recurrence', () => {
      const result = parseTaskInput('Gym workout 7am');
      expect(result.title).toBe('Gym workout');
      expect(result.category).toBe('health');
      expect(result.icon).toBe('💪');
      expect(result.recurrence).toEqual({ type: 'daily' });
      expect(result.reminderTime).toBe('07:00');
    });

    it('parses Hinglish "subah shaam" as twice daily', () => {
      const result = parseTaskInput('BP medicine subah shaam');
      expect(result.title).toBe('BP medicine');
      expect(result.isMultiTime).toBe(true);
      expect(result.timesPerDay).toBe(2);
      expect(result.category).toBe('health');
    });

    it('parses Hinglish "har mahine 5 ko" with amount and clean title', () => {
      const result = parseTaskInput('Har mahine 5 ko rent 15000');
      expect(result.title).toBe('Rent');
      expect(result.amount).toBe(15000);
      expect(result.recurrence).toEqual({ type: 'monthDay', dayOfMonth: 5 });
    });

    it('parses Hinglish "15 din me" interval', () => {
      const result = parseTaskInput('Car wash 15 din me');
      expect(result.title).toBe('Car wash');
      expect(result.category).toBe('vehicle');
      expect(result.recurrence).toEqual({ type: 'interval', interval: 15, intervalUnit: 'days' });
    });
  });

  describe('Alarm toggle Smart Input parsing', () => {
    it('parses "with alarm" in English and enables alarm with cleaned title and detected token', () => {
      const res = parseTaskInput('Take BP medicine daily at 9am with alarm');
      expect(res.alarmEnabled).toBe(true);
      expect(res.title).toBe('Take BP medicine');
      expect(res.reminderTime).toBe('09:00');
      expect(res.detectedTokens?.some((t) => t.id === 'alarm' && t.label === 'Alarm ON')).toBe(true);
    });

    it('parses "alarm on" and "fullscreen alarm"', () => {
      const res1 = parseTaskInput('Wake up daily 6am alarm on');
      expect(res1.alarmEnabled).toBe(true);
      expect(res1.title).toBe('Wake up');

      const res2 = parseTaskInput('Morning run 6:30am fullscreen alarm');
      expect(res2.alarmEnabled).toBe(true);
      expect(res2.title).toBe('Morning run');
    });

    it('parses "no alarm" and "without alarm" to explicitly disable alarm', () => {
      const res1 = parseTaskInput('Water plants weekly 8am no alarm');
      expect(res1.alarmEnabled).toBe(false);
      expect(res1.title).toBe('Water plants');
      expect(res1.detectedTokens?.some((t) => t.id === 'alarm' && t.label === 'Alarm OFF')).toBe(true);

      const res2 = parseTaskInput('Pay electricity bill monthly without alarm');
      expect(res2.alarmEnabled).toBe(false);
      expect(res2.title).toBe('Pay electricity bill');

      const res3 = parseTaskInput('Read book daily 10pm alarm off');
      expect(res3.alarmEnabled).toBe(false);
      expect(res3.title).toBe('Read book');
    });

    it('parses Hindi "अलार्म के साथ" and "अलार्म" with Hindi badge', () => {
      const res1 = parseTaskInput('दवाई रोज़ सुबह 9 बजे अलार्म के साथ', 'hi');
      expect(res1.alarmEnabled).toBe(true);
      expect(res1.title).toBe('दवाई');
      expect(res1.detectedTokens?.some((t) => t.id === 'alarm' && t.label === 'अलार्म चालू')).toBe(true);

      const res2 = parseTaskInput('कसरत सुबह 7 बजे अलार्म', 'hi');
      expect(res2.alarmEnabled).toBe(true);
      expect(res2.title).toBe('कसरत');
    });

    it('parses Hindi "बिना अलार्म" and "अलार्म बंद" to disable alarm', () => {
      const res1 = parseTaskInput('किराया बिना अलार्म', 'hi');
      expect(res1.alarmEnabled).toBe(false);
      expect(res1.title).toBe('किराया');
      expect(res1.detectedTokens?.some((t) => t.id === 'alarm' && t.label === 'अलार्म बंद')).toBe(true);

      const res2 = parseTaskInput('सब्जी लाना अलार्म बंद', 'hi');
      expect(res2.alarmEnabled).toBe(false);
      expect(res2.title).toBe('सब्जी लाना');
    });

    it('does NOT trigger alarm toggle for physical device sensors like smoke alarm or car alarm', () => {
      const res1 = parseTaskInput('Check smoke alarm battery yearly');
      expect(res1.alarmEnabled).toBeUndefined();
      expect(res1.title).toBe('Check smoke alarm battery');

      const res2 = parseTaskInput('Inspect car alarm every 6 months');
      expect(res2.alarmEnabled).toBeUndefined();
      expect(res2.title).toBe('Inspect car alarm');

      // But if explicit "with alarm" is attached, it triggers alarm
      const res3 = parseTaskInput('Smoke alarm test monthly at 10am with alarm');
      expect(res3.alarmEnabled).toBe(true);
      expect(res3.title).toBe('Smoke alarm test');
    });
  });

  describe('Indian household categories parsing', () => {
    it('parses Daily Supplies & Vendors inputs', () => {
      const r1 = parseTaskInput('20L water can every 3 days ₹90');
      expect(r1.category).toBe('supplies');
      expect(r1.amount).toBe(90);
      expect(r1.recurrence).toEqual({ type: 'interval', interval: 3, intervalUnit: 'days' });

      const r2 = parseTaskInput('LPG gas cylinder refill every 45 days');
      expect(r2.category).toBe('supplies');
      expect(r2.icon).toBe('🔥');

      const r3 = parseTaskInput('Dhobi clothes iron every week ₹350');
      expect(r3.category).toBe('supplies');
      expect(r3.amount).toBe(350);
      expect(r3.icon).toBe('👔');
    });

    it('parses Home Maintenance & Appliances inputs', () => {
      const r1 = parseTaskInput('AC service every 6 months');
      expect(r1.category).toBe('maintenance');
      expect(r1.icon).toBe('🔧');

      const r2 = parseTaskInput('RO filter change every 3 months');
      expect(r2.category).toBe('maintenance');

      const r3 = parseTaskInput('Clean kitchen chimney every 2 months');
      expect(r3.category).toBe('maintenance');
      expect(r3.icon).toBe('🔧');
    });

    it('parses Essential Documents & Mobility inputs', () => {
      const r1 = parseTaskInput('FASTag recharge ₹1000 monthly');
      expect(r1.category).toBe('documents');
      expect(r1.amount).toBe(1000);
      expect(r1.icon).toBe('🪪');

      const r2 = parseTaskInput('Vehicle PUC renewal every 6 months');
      expect(r2.category).toBe('documents');
      expect(r2.icon).toBe('🪪');

      const r3 = parseTaskInput('Property tax payment yearly');
      expect(r3.category).toBe('documents');
    });

    it('parses Plants & Balcony Garden inputs', () => {
      const r1 = parseTaskInput('Water balcony plants daily 8am');
      expect(r1.category).toBe('gardening');
      expect(r1.icon).toBe('🪴');
      expect(r1.reminderTime).toBe('08:00');

      const r2 = parseTaskInput('Add vermicompost to plants every 15 days');
      expect(r2.category).toBe('gardening');
      expect(r2.recurrence).toEqual({ type: 'interval', interval: 15, intervalUnit: 'days' });

      const r3 = parseTaskInput('Neem oil pest spray every 15 days');
      expect(r3.category).toBe('gardening');
    });
  });
});

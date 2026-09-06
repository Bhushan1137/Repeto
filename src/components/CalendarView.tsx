import React, { useState, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Card, IconButton } from 'react-native-paper';
import { Colors, Radius } from '@/constants/theme';
import type { RepeatingTask } from '@/types';
import { AppIcon } from './AppIcon';

interface CalendarViewProps {
  tasks: RepeatingTask[];
  selectedDate: Date | null;
  onSelectDate: (date: Date | null) => void;
  language: 'en' | 'hi';
}

const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_HI = ['रवि', 'सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि'];

export function CalendarView({ tasks, selectedDate, onSelectDate, language }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Navigation handlers
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Generate days grid
  const daysInMonth = useMemo(() => new Date(year, month + 1, 0).getDate(), [year, month]);
  const firstDayIndex = useMemo(() => new Date(year, month, 1).getDay(), [year, month]);

  const daysGrid = useMemo(() => {
    const grid: (Date | null)[] = [];
    // Add empty slots for days of previous month
    for (let i = 0; i < firstDayIndex; i++) {
      grid.push(null);
    }
    // Add days of current month
    for (let i = 1; i <= daysInMonth; i++) {
      grid.push(new Date(year, month, i));
    }
    return grid;
  }, [year, month, daysInMonth, firstDayIndex]);

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  // Compute status map for the visible days
  const dayStatuses = useMemo(() => {
    const statusMap: Record<string, { completed: boolean; due: boolean }> = {};

    daysGrid.forEach((date) => {
      if (!date) return;
      const dateStr = date.toDateString();
      let completed = false;
      let due = false;

      tasks.forEach((task) => {
        // Check if completed on this date
        const hasCompletion = task.history.some(
          (h) => h.completedAt && isSameDay(new Date(h.completedAt), date) && (h.status === 'on_time' || h.status === 'late')
        );
        if (hasCompletion) {
          completed = true;
        }

        // Check if due on this date (only for today or future dates)
        const isFutureOrToday = date >= new Date(new Date().setHours(0, 0, 0, 0));
        if (isFutureOrToday && isSameDay(new Date(task.nextDueDate), date)) {
          due = true;
        }
      });

      statusMap[dateStr] = { completed, due };
    });

    return statusMap;
  }, [daysGrid, tasks]);

  const monthLabel = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(language === 'hi' ? 'hi-IN' : 'en-US', {
      month: 'long',
      year: 'numeric',
    });
    return formatter.format(currentDate);
  }, [currentDate, language]);

  const weekdays = language === 'hi' ? WEEKDAYS_HI : WEEKDAYS_EN;

  return (
    <Card style={styles.card} mode="elevated">
      <Card.Content style={styles.content}>
        {/* Header: Month and controls */}
        <View style={styles.header}>
          <Text style={styles.monthTitle}>{monthLabel}</Text>
          <View style={styles.controls}>
            <IconButton
              icon={() => <AppIcon name="chevron-back" size={18} color={Colors.indigo950} />}
              onPress={handlePrevMonth}
              size={20}
              style={styles.iconBtn}
            />
            <IconButton
              icon={() => <AppIcon name="chevron-forward" size={18} color={Colors.indigo950} />}
              onPress={handleNextMonth}
              size={20}
              style={styles.iconBtn}
            />
          </View>
        </View>

        {/* Weekday headers */}
        <View style={styles.weekdaysRow}>
          {weekdays.map((day, idx) => (
            <Text key={idx} style={styles.weekdayText}>
              {day}
            </Text>
          ))}
        </View>

        {/* Calendar days grid */}
        <View style={styles.daysGrid}>
          {daysGrid.map((date, idx) => {
            if (!date) {
              return <View key={`empty-${idx}`} style={styles.dayCellEmpty} />;
            }

            const dateStr = date.toDateString();
            const isSelected = selectedDate && isSameDay(selectedDate, date);
            const isToday = isSameDay(new Date(), date);
            const { completed, due } = dayStatuses[dateStr] || { completed: false, due: false };

            return (
              <TouchableOpacity
                key={dateStr}
                style={[
                  styles.dayCell,
                  isSelected && styles.dayCellSelected,
                  isToday && !isSelected && styles.dayCellToday,
                ]}
                onPress={() => {
                  if (isSelected) {
                    onSelectDate(null); // Deselect
                  } else {
                    onSelectDate(date); // Select
                  }
                }}
              >
                <Text
                  style={[
                    styles.dayText,
                    isSelected && styles.dayTextSelected,
                    isToday && !isSelected && styles.dayTextToday,
                  ]}
                >
                  {date.getDate()}
                </Text>
                
                {/* Point markers */}
                <View style={styles.dotsContainer}>
                  {completed && <View style={[styles.dot, styles.dotCompleted]} />}
                  {due && <View style={[styles.dot, styles.dotDue]} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    marginBottom: 16,
    elevation: 2,
    overflow: 'hidden',
  },
  content: {
    padding: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  monthTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 16,
    color: Colors.indigo950,
    textTransform: 'capitalize',
  },
  controls: {
    flexDirection: 'row',
    gap: 4,
  },
  iconBtn: {
    margin: 0,
    backgroundColor: Colors.ivory,
    borderRadius: Radius.full,
  },
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ivoryLine,
    paddingBottom: 6,
  },
  weekdayText: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 10,
    fontFamily: 'Manrope_700Bold',
    color: Colors.inkSoft,
    textTransform: 'uppercase',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 8,
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1.1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radius.sm,
    paddingVertical: 2,
  },
  dayCellEmpty: {
    width: '14.28%',
    aspectRatio: 1.1,
  },
  dayCellSelected: {
    backgroundColor: Colors.marigold,
  },
  dayCellToday: {
    backgroundColor: Colors.ivoryLine,
  },
  dayText: {
    fontSize: 12,
    fontFamily: 'Manrope_600SemiBold',
    color: Colors.ink,
  },
  dayTextSelected: {
    fontFamily: 'Manrope_800ExtraBold',
    color: Colors.indigo950,
  },
  dayTextToday: {
    fontFamily: 'Manrope_800ExtraBold',
    color: Colors.indigo950,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 3,
    marginTop: 2,
    height: 4,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  dotCompleted: {
    backgroundColor: Colors.teal,
  },
  dotDue: {
    backgroundColor: Colors.clay,
  },
});

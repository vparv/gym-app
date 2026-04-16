import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';
import type { WorkoutDay, WorkoutDayStatus } from '../types';

export type WorkoutDayListItem = {
  day: WorkoutDay;
  status: WorkoutDayStatus;
  completedAt?: string;
  isNextUp: boolean;
};

type DayListProps = {
  items: WorkoutDayListItem[];
  onSelectDay: (dayId: string) => void;
};

export function DayList({ items, onSelectDay }: DayListProps) {
  return (
    <View style={styles.list}>
      {items.map(({ day, status, completedAt, isNextUp }) => (
        <Pressable
          key={day.id}
          onPress={() => onSelectDay(day.id)}
          style={[
            styles.row,
            status === 'in_progress' ? styles.rowActive : undefined,
            status === 'completed' ? styles.rowCompleted : undefined,
          ]}
        >
          <View style={styles.rowTop}>
            <View style={styles.dayMeta}>
              <Text style={styles.dayName}>{day.name}</Text>
              <Text style={styles.dayFocus}>{day.focus}</Text>
            </View>

            <View style={styles.statusArea}>
              <View
                style={[
                  styles.statusPill,
                  status === 'completed'
                    ? styles.statusPillCompleted
                    : status === 'in_progress'
                      ? styles.statusPillActive
                      : styles.statusPillPending,
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    status === 'completed'
                      ? styles.statusTextCompleted
                      : status === 'in_progress'
                        ? styles.statusTextActive
                        : styles.statusTextPending,
                  ]}
                >
                  {status === 'completed' ? 'Done' : status === 'in_progress' ? 'In progress' : 'Not started'}
                </Text>
              </View>

              {completedAt ? <Text style={styles.dateText}>{formatShortDate(completedAt)}</Text> : null}
            </View>
          </View>

          <View style={styles.rowBottom}>
            <View style={styles.countPill}>
              <Text style={styles.countText}>{day.exercises.length} exercises</Text>
            </View>

            {isNextUp ? (
              <View style={styles.nextPill}>
                <Text style={styles.nextText}>Next up</Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

const styles = StyleSheet.create({
  list: {
    gap: 12,
  },
  row: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    gap: 12,
  },
  rowActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
  },
  rowCompleted: {
    borderColor: theme.colors.successBorder,
    backgroundColor: theme.colors.successSurface,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowBottom: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
  dayMeta: {
    gap: 4,
    flex: 1,
  },
  dayName: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  dayFocus: {
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  statusArea: {
    alignItems: 'flex-end',
    gap: 6,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusPillPending: {
    backgroundColor: theme.colors.canvas,
  },
  statusPillActive: {
    backgroundColor: theme.colors.accent,
  },
  statusPillCompleted: {
    backgroundColor: theme.colors.successBorder,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statusTextPending: {
    color: theme.colors.muted,
  },
  statusTextActive: {
    color: theme.colors.accentText,
  },
  statusTextCompleted: {
    color: theme.colors.successText,
  },
  dateText: {
    color: theme.colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  countPill: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.badge,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  countText: {
    color: theme.colors.badgeText,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  nextPill: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.accentSoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  nextText: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});

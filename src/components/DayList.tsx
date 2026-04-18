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
      {items.map(({ day, status, completedAt, isNextUp }, index) => (
        <Pressable
          key={day.id}
          onPress={() => onSelectDay(day.id)}
          style={({ pressed }) => [
            styles.row,
            status === 'in_progress' ? styles.rowActive : undefined,
            status === 'completed' ? styles.rowCompleted : undefined,
            pressed ? styles.rowPressed : undefined,
          ]}
        >
          <View style={styles.rowTop}>
            <View style={styles.leadingCluster}>
              <View style={styles.dayOrderBadge}>
                <Text style={styles.dayOrderText}>{String(index + 1).padStart(2, '0')}</Text>
              </View>

              <View style={styles.dayMeta}>
                <View style={styles.dayNameRow}>
                  <Text style={styles.dayName}>{day.name}</Text>
                  <Text style={styles.openLabel}>Open</Text>
                </View>
                <Text style={styles.dayFocus}>{day.focus}</Text>
              </View>
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
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 18,
    gap: 12,
    shadowColor: theme.colors.shadow,
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  rowPressed: {
    transform: [{ scale: 0.99 }],
  },
  rowActive: {
    borderColor: theme.colors.accent,
    borderWidth: 2,
    backgroundColor: theme.colors.surfaceElevated,
  },
  rowCompleted: {
    borderColor: theme.colors.successBorder,
    borderWidth: 2,
    backgroundColor: theme.colors.surfaceElevated,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  leadingCluster: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
  },
  rowBottom: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
  dayOrderBadge: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: theme.colors.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dayOrderText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  dayMeta: {
    gap: 4,
    flex: 1,
  },
  dayNameRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
  dayName: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  dayFocus: {
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 22,
  },
  openLabel: {
    color: theme.colors.accent,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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

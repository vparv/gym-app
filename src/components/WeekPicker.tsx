import { ScrollView, Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

type WeekOption = {
  weekNumber: number;
  block: string;
};

type WeekPickerProps = {
  weeks: WeekOption[];
  activeWeek: number;
  onSelectWeek: (weekNumber: number) => void;
};

export function WeekPicker({ weeks, activeWeek, onSelectWeek }: WeekPickerProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {weeks.map((week) => {
        const isSelected = week.weekNumber === activeWeek;

        return (
          <Pressable
            key={week.weekNumber}
            onPress={() => onSelectWeek(week.weekNumber)}
            style={({ pressed }) => [
              styles.card,
              isSelected ? styles.cardSelected : undefined,
              pressed ? styles.cardPressed : undefined,
            ]}
          >
            <View style={styles.cardHeader}>
              <Text style={[styles.eyebrow, isSelected ? styles.eyebrowSelected : undefined]}>
                Week
              </Text>
              {isSelected ? (
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>Active</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.value, isSelected ? styles.valueSelected : undefined]}>
              {week.weekNumber}
            </Text>
            <Text style={[styles.label, isSelected ? styles.labelSelected : undefined]}>
              {week.block}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 12,
    paddingVertical: 2,
  },
  card: {
    width: 150,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    gap: 8,
    shadowColor: theme.colors.shadow,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
  },
  cardSelected: {
    backgroundColor: theme.colors.surfaceElevated,
    borderColor: theme.colors.accent,
    borderWidth: 2,
    shadowOpacity: 0.1,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  activeBadge: {
    backgroundColor: theme.colors.accentMuted,
    borderWidth: 1,
    borderColor: theme.colors.accentSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  activeBadgeText: {
    color: theme.colors.accentStrong,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  eyebrow: {
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  eyebrowSelected: {
    color: theme.colors.accent,
  },
  value: {
    color: theme.colors.text,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  valueSelected: {
    color: theme.colors.text,
  },
  label: {
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  labelSelected: {
    color: theme.colors.muted,
  },
});

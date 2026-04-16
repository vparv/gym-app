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
            style={[styles.card, isSelected ? styles.cardSelected : undefined]}
          >
            <Text style={[styles.eyebrow, isSelected ? styles.eyebrowSelected : undefined]}>
              Week
            </Text>
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
  },
  card: {
    width: 122,
    backgroundColor: theme.colors.chip,
    borderRadius: theme.radii.lg,
    padding: 14,
    gap: 4,
  },
  cardSelected: {
    backgroundColor: theme.colors.chipSelected,
  },
  eyebrow: {
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  eyebrowSelected: {
    color: theme.colors.accentText,
  },
  value: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  valueSelected: {
    color: theme.colors.chipSelectedText,
  },
  label: {
    color: theme.colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  labelSelected: {
    color: theme.colors.accentText,
  },
});

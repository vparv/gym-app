import Papa from 'papaparse';

import { DAY_ORDER, type ExerciseOption, type PlannedExercise, type ProgramWeek, type WorkoutDay, type WorkoutDayName, type WorkoutProgram } from '../types';

type CsvRow = Record<(typeof EXPECTED_CSV_HEADERS)[number], string>;

type NormalizedRow = {
  weekNumber: number;
  block: string;
  workoutDayName: WorkoutDayName;
  focus: string;
  exerciseOrder: number;
  sourcePdfPage: number;
  warmupSets: string;
  workingSets: number;
  reps: string;
  earlySetRpe?: string;
  lastSetRpe?: string;
  rest?: string;
  lastSetIntensityTechnique?: string;
  notes: string;
  options: ExerciseOption[];
};

export const EXPECTED_CSV_HEADERS = [
  'week',
  'block',
  'workout_day_name',
  'focus',
  'exercise_order',
  'source_pdf_page',
  'exercise_name',
  'exercise_video_url',
  'substitution_option_1',
  'substitution_option_1_video_url',
  'substitution_option_2',
  'substitution_option_2_video_url',
  'last_set_intensity_technique',
  'warmup_sets',
  'working_sets',
  'reps',
  'early_set_rpe',
  'last_set_rpe',
  'rest',
  'notes',
] as const;

const OPTION_KEYS = ['primary', 'substitution-1', 'substitution-2'] as const;

export function parseWorkoutProgram(csvText: string, sourceName: string): WorkoutProgram {
  const parsed = Papa.parse<CsvRow>(csvText, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.trim(),
    transform: (value) => value.trim(),
  });

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors[0]?.message ?? 'Could not parse the CSV file.');
  }

  assertExpectedHeaders(parsed.meta.fields ?? []);

  const rows = parsed.data.map((row, index) => normalizeRow(row, index + 2));
  const weeks = buildProgramWeeks(rows);
  assertExpectedProgramShape(weeks);

  return {
    importedAt: new Date().toISOString(),
    sourceName,
    activeWeek: 1,
    weeks,
  };
}

function assertExpectedHeaders(headers: string[]) {
  if (headers.length !== EXPECTED_CSV_HEADERS.length) {
    throw new Error('The CSV header count does not match the expected workout program format.');
  }

  EXPECTED_CSV_HEADERS.forEach((header, index) => {
    if (headers[index] !== header) {
      throw new Error(`Unexpected CSV header at position ${index + 1}: expected "${header}".`);
    }
  });
}

function normalizeRow(row: CsvRow, lineNumber: number): NormalizedRow {
  const workoutDayName = parseWorkoutDayName(requireText(row.workout_day_name, 'workout_day_name', lineNumber), lineNumber);

  return {
    weekNumber: parseInteger(row.week, 'week', lineNumber),
    block: requireText(row.block, 'block', lineNumber),
    workoutDayName,
    focus: requireText(row.focus, 'focus', lineNumber),
    exerciseOrder: parseInteger(row.exercise_order, 'exercise_order', lineNumber),
    sourcePdfPage: parseInteger(row.source_pdf_page, 'source_pdf_page', lineNumber),
    warmupSets: requireText(row.warmup_sets, 'warmup_sets', lineNumber),
    workingSets: parseInteger(row.working_sets, 'working_sets', lineNumber),
    reps: requireText(row.reps, 'reps', lineNumber),
    earlySetRpe: normalizeOptionalText(row.early_set_rpe),
    lastSetRpe: normalizeOptionalText(row.last_set_rpe),
    rest: normalizeOptionalText(row.rest),
    lastSetIntensityTechnique: normalizeOptionalText(row.last_set_intensity_technique),
    notes: requireText(row.notes, 'notes', lineNumber),
    options: createExerciseOptions(row, lineNumber),
  };
}

function createExerciseOptions(row: CsvRow, lineNumber: number) {
  const labels = [
    requireText(row.exercise_name, 'exercise_name', lineNumber),
    requireText(row.substitution_option_1, 'substitution_option_1', lineNumber),
    requireText(row.substitution_option_2, 'substitution_option_2', lineNumber),
  ];

  const urls = [
    requireText(row.exercise_video_url, 'exercise_video_url', lineNumber),
    requireText(row.substitution_option_1_video_url, 'substitution_option_1_video_url', lineNumber),
    requireText(row.substitution_option_2_video_url, 'substitution_option_2_video_url', lineNumber),
  ];

  return labels.map((label, index) => ({
    key: OPTION_KEYS[index],
    label,
    videoUrl: urls[index],
    isPrimary: index === 0,
    historyKey: createHistoryKey(label),
  }));
}

function buildProgramWeeks(rows: NormalizedRow[]): ProgramWeek[] {
  const weekMap = new Map<number, Map<WorkoutDayName, NormalizedRow[]>>();

  rows.forEach((row) => {
    const daysMap = weekMap.get(row.weekNumber) ?? new Map<WorkoutDayName, NormalizedRow[]>();
    const dayRows = daysMap.get(row.workoutDayName) ?? [];
    dayRows.push(row);
    daysMap.set(row.workoutDayName, dayRows);
    weekMap.set(row.weekNumber, daysMap);
  });

  return Array.from(weekMap.entries())
    .sort(([leftWeek], [rightWeek]) => leftWeek - rightWeek)
    .map(([weekNumber, daysMap]) => ({
      id: `week-${weekNumber}`,
      weekNumber,
      block: getSharedValue(daysMap, 'block', weekNumber),
      days: DAY_ORDER.map((dayName, index) => buildWorkoutDay(weekNumber, dayName, index, daysMap.get(dayName) ?? [])),
    }));
}

function buildWorkoutDay(
  weekNumber: number,
  dayName: WorkoutDayName,
  order: number,
  rows: NormalizedRow[]
): WorkoutDay {
  if (rows.length === 0) {
    throw new Error(`Week ${weekNumber} is missing the "${dayName}" workout day.`);
  }

  const focus = getSharedField(rows, 'focus', weekNumber, dayName);
  const sourcePdfPage = getSharedField(rows, 'sourcePdfPage', weekNumber, dayName);

  return {
    id: `week-${weekNumber}-${dayName.toLowerCase()}`,
    weekNumber,
    name: dayName,
    focus,
    order,
    sourcePdfPage,
    exercises: rows
      .sort((left, right) => left.exerciseOrder - right.exerciseOrder)
      .map<PlannedExercise>((row) => ({
        id: `week-${weekNumber}-${dayName.toLowerCase()}-exercise-${row.exerciseOrder}`,
        weekNumber,
        dayName,
        order: row.exerciseOrder,
        options: row.options,
        defaultOptionKey: 'primary',
        warmupSetsText: row.warmupSets,
        workingSets: row.workingSets,
        repsText: row.reps,
        earlySetRpeText: row.earlySetRpe,
        lastSetRpeText: row.lastSetRpe,
        restText: row.rest,
        lastSetIntensityTechnique: row.lastSetIntensityTechnique,
        notes: row.notes,
      })),
  };
}

function getSharedValue(
  daysMap: Map<WorkoutDayName, NormalizedRow[]>,
  field: 'block',
  weekNumber: number
) {
  const values = Array.from(daysMap.values())
    .flat()
    .map((row) => row[field]);

  const uniqueValues = [...new Set(values)];

  if (uniqueValues.length !== 1) {
    throw new Error(`Week ${weekNumber} has inconsistent ${field} values.`);
  }

  return uniqueValues[0];
}

function getSharedField<RowKey extends 'focus' | 'sourcePdfPage'>(
  rows: NormalizedRow[],
  field: RowKey,
  weekNumber: number,
  dayName: WorkoutDayName
) {
  const uniqueValues = [...new Set(rows.map((row) => row[field]))];

  if (uniqueValues.length !== 1) {
    throw new Error(`Week ${weekNumber} day ${dayName} has inconsistent ${field} values.`);
  }

  return uniqueValues[0];
}

function assertExpectedProgramShape(weeks: ProgramWeek[]) {
  const expectedWeeks = Array.from({ length: 12 }, (_, index) => index + 1);
  const actualWeeks = weeks.map((week) => week.weekNumber);

  if (expectedWeeks.join(',') !== actualWeeks.join(',')) {
    throw new Error('The workout program must contain weeks 1 through 12.');
  }

  weeks.forEach((week) => {
    const dayNames = week.days.map((day) => day.name);

    if (dayNames.join(',') !== DAY_ORDER.join(',')) {
      throw new Error(`Week ${week.weekNumber} does not include the expected workout day order.`);
    }
  });
}

function requireText(value: string, field: string, lineNumber: number) {
  const normalized = normalizeOptionalText(value);

  if (!normalized) {
    throw new Error(`Missing value for "${field}" on CSV line ${lineNumber}.`);
  }

  return normalized;
}

function parseInteger(value: string, field: string, lineNumber: number) {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedValue)) {
    throw new Error(`Expected "${field}" to be a whole number on CSV line ${lineNumber}.`);
  }

  return parsedValue;
}

function parseWorkoutDayName(value: string, lineNumber: number): WorkoutDayName {
  if (DAY_ORDER.includes(value as WorkoutDayName)) {
    return value as WorkoutDayName;
  }

  throw new Error(`Unexpected workout day "${value}" on CSV line ${lineNumber}.`);
}

function normalizeOptionalText(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function createHistoryKey(label: string) {
  return label
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}

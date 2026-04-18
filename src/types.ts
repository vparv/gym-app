export const DAY_ORDER = ['Upper', 'Lower', 'Pull', 'Push', 'Legs'] as const;

export type WorkoutDayName = (typeof DAY_ORDER)[number];
export type WorkoutSessionStatus = 'in_progress' | 'completed';
export type WorkoutDayStatus = 'not_started' | 'in_progress' | 'completed';

export type AppViewState = { screen: 'home' } | { screen: 'day'; dayId: string };

export type AppMessage = {
  type: 'success' | 'error';
  text: string;
};

export type WorkoutProgram = {
  importedAt: string;
  sourceName: string;
  activeWeek: number;
  weeks: ProgramWeek[];
};

export type ProgramWeek = {
  id: string;
  weekNumber: number;
  block: string;
  days: WorkoutDay[];
};

export type WorkoutDay = {
  id: string;
  weekNumber: number;
  name: WorkoutDayName;
  focus: string;
  order: number;
  sourcePdfPage?: number;
  exercises: PlannedExercise[];
};

export type PlannedExercise = {
  id: string;
  weekNumber: number;
  dayName: WorkoutDayName;
  order: number;
  options: ExerciseOption[];
  defaultOptionKey: string;
  warmupSetsText: string;
  workingSets: number;
  repsText: string;
  earlySetRpeText?: string;
  lastSetRpeText?: string;
  restText?: string;
  lastSetIntensityTechnique?: string;
  notes: string;
};

export type ExerciseOption = {
  key: string;
  label: string;
  videoUrl: string;
  isPrimary: boolean;
  historyKey: string;
};

export type SetLog = {
  setNumber: number;
  weight: string;
  repsCompleted?: string;
};

export type WorkoutSession = {
  id: string;
  dayId: string;
  dayName: WorkoutDayName;
  weekNumber: number;
  status: WorkoutSessionStatus;
  startedAt: string;
  completedAt?: string;
  createdAt: string;
};

export type ExerciseLog = {
  id: string;
  programExerciseId: string;
  dayId?: string;
  sessionId?: string;
  performedOptionKey: string;
  performedOptionLabel: string;
  historyKey: string;
  weekNumber: number;
  dayName: WorkoutDayName;
  loggedAt: string;
  exerciseNote?: string;
  setLogs: SetLog[];
};

export type ExerciseSetDraft = {
  setNumber: number;
  weight: string;
  repsCompleted: string;
};

export type ExerciseLogDraft = {
  selectedOptionKey: string;
  setLogs: ExerciseSetDraft[];
  completedSetNumbers?: number[];
  skippedSetNumbers?: number[];
  exerciseNote: string;
};

# Gym App MVP Implementation Spec

## Product goal

Turn this Expo starter into a small personal gym app for the bodybuilding transformation program in `bodybuilding_transformation_workouts.csv`.

The app should do three things well:

1. Import the program from the provided CSV.
2. Make it easy to see the correct exercises for a given week and workout day.
3. Let the user log working weights quickly during training.

This is a single-user, local-first app for iOS and web. It should stay narrow and should not become a generalized fitness platform.

## Core product principles

- Build around the exact CSV schema already provided.
- Optimize for fast workout execution, not configuration flexibility.
- Keep one imported program active at a time.
- Store the workout structure from CSV and the weight logs locally.
- Avoid accounts, sync, notifications, calendars, and backend services.

## What changed from the earlier draft

The original spec assumed a simple list of workout days with one static exercise list.

The actual CSV is more structured:

- 12 weeks total
- 2 blocks: `Foundation Block` and `Ramping Block`
- 5 workout days per week: `Upper`, `Lower`, `Pull`, `Push`, `Legs`
- 408 exercise rows total
- 20 columns of metadata per exercise row
- `exercise_name` is the prescribed movement and the substitution columns are fallbacks

That means the MVP needs a week-aware program browser, not just a flat workout-day list.

## MVP scope

### In scope

- Import the provided CSV format.
- Parse weeks, blocks, workout days, and exercises.
- Let the user switch between weeks manually.
- Show the workout days for the selected week.
- Show exercises for a selected day in the correct order.
- Let the user log either the prescribed movement or a selected substitution.
- Display the key coaching data from the CSV:
  - exercise name
  - main video link
  - substitution options
  - warmup sets
  - working sets
  - reps
  - early-set RPE
  - last-set RPE
  - rest
  - intensity technique
  - notes
- Let the user log working weights for each planned working set.
- Persist logs locally across app restarts and browser reloads.
- Show the latest logged weights for the movement variation actually performed.
- Allow replacing or resetting the imported program.

### Out of scope

- Android support
- Generic CSV mapping UI
- Editing the workout program inside the app
- Automatic calendar scheduling
- Push reminders
- Cloud sync
- Accounts
- Progress charts and analytics dashboards
- PR tracking, calories, macros, measurements
- Social features
- HealthKit / Apple Watch integrations
- AI-generated workout recommendations

## Supported CSV schema

The MVP should support the exact schema in the provided file and reject imports that do not match it.

### Expected headers

- `week`
- `block`
- `workout_day_name`
- `focus`
- `exercise_order`
- `source_pdf_page`
- `exercise_name`
- `exercise_video_url`
- `substitution_option_1`
- `substitution_option_1_video_url`
- `substitution_option_2`
- `substitution_option_2_video_url`
- `last_set_intensity_technique`
- `warmup_sets`
- `working_sets`
- `reps`
- `early_set_rpe`
- `last_set_rpe`
- `rest`
- `notes`

### Observed shape of the current file

- `week` is `1` through `12`
- `block` is either `Foundation Block` or `Ramping Block`
- `workout_day_name` is one of `Upper`, `Lower`, `Pull`, `Push`, `Legs`
- `focus` is one of `Strength Focus` or `Hypertrophy Focus`
- `exercise_order` is the order within the workout day
- `working_sets` is numeric
- `warmup_sets`, `reps`, `early_set_rpe`, `last_set_rpe`, and `rest` are display strings, not strict numeric fields
- `last_set_intensity_technique` is blank when absent, otherwise it contains a real instruction such as `Myo-reps`
- `early_set_rpe` is sometimes blank and should be treated as optional display data
- `exercise_name` should be treated as the default prescribed movement for that slot
- substitution columns are populated and should be treated as meaningful workout data, not backup metadata

### Important interpretation rules

- One row represents one planned exercise for one specific week and workout day.
- The CSV is the source of truth for workout structure.
- Weight logs are runtime data and are not imported from CSV.
- `working_sets` determines how many weight inputs are shown.
- `warmup_sets` is display guidance only in the MVP.
- Blank strings should be treated as missing optional values.
- `exercise_name` is the default movement to present first.
- `substitution_option_1` and `substitution_option_2` are alternative movements for the same exercise slot.

## Product behavior

### Program navigation

The app should not try to infer the current week from dates.

Instead:

- The user manually selects the active week.
- The app remembers the last selected week locally.
- The selected week determines which workout days and exercises are shown.

### Workout-day navigation

Within the selected week, show the days in this order:

1. Upper
2. Lower
3. Pull
4. Push
5. Legs

This order is consistent in the provided CSV and should be treated as the program order.

### Exercise display

Each exercise card should show:

- prescribed exercise name
- focus
- prescribed video link
- substitution option 1 with link
- substitution option 2 with link
- warmup sets
- working sets
- reps
- early-set RPE
- last-set RPE
- rest
- intensity technique if present
- notes

### Variation handling

The corrected CSV makes the variation semantics clear:

- `exercise_name` is the prescribed option for the slot.
- `substitution_option_1` and `substitution_option_2` are alternatives.
- The card should default to the prescribed option.
- The user should be able to switch to a substitution before logging if they actually performed it.
- History should be tracked per performed variation, not merged across all three options.

### Weight logging

The app should only log working sets, not warmup sets.

For each exercise:

- render one weight input per `working_sets`
- let the user keep the prescribed option or select one substitution
- optionally allow reps-completed input per working set only if it stays lightweight
- save one log record for that exercise submission
- show the most recent saved weights for the selected movement variation

This keeps the tracking useful without turning the app into a full workout logger.

## Primary user stories

- As a user, I can import the bodybuilding transformation CSV and immediately browse the program.
- As a user, I can select a week manually so I can follow the correct weekly progression.
- As a user, I can open a workout day and see the exercises in the correct order.
- As a user, I can tap the prescribed exercise video if I need a refresher.
- As a user, I can view substitution options if a machine or station is unavailable.
- As a user, I can log the weight used for each working set of the movement I actually performed.
- As a user, I can see the latest logged weights for the same movement variation so I know where to start.

## Data model

Use plain TypeScript objects in the app layer, persisted through Supabase as the single source of truth for iOS and web.

### Imported program data

```ts
type WorkoutProgram = {
  importedAt: string;
  sourceName: string;
  activeWeek: number;
  weeks: ProgramWeek[];
};

type ProgramWeek = {
  id: string;
  weekNumber: number;
  block: string;
  days: WorkoutDay[];
};

type WorkoutDay = {
  id: string;
  weekNumber: number;
  name: 'Upper' | 'Lower' | 'Pull' | 'Push' | 'Legs';
  focus: string;
  order: number;
  sourcePdfPage?: number;
  exercises: PlannedExercise[];
};

type PlannedExercise = {
  id: string;
  weekNumber: number;
  dayName: string;
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

type ExerciseOption = {
  key: string;
  label: string;
  videoUrl: string;
  isPrimary: boolean;
};
```

### Log data

```ts
type ExerciseLog = {
  id: string;
  programExerciseId: string;
  performedOptionKey: string;
  performedOptionLabel: string;
  historyKey: string;
  weekNumber: number;
  dayName: string;
  loggedAt: string;
  setLogs: SetLog[];
};

type SetLog = {
  setNumber: number;
  weight: string;
  repsCompleted?: string;
};
```

### Storage keys

- `gym-program:v1`
- `gym-logs:v1`

## Parsing and normalization rules

- Require the full header set listed above.
- Trim whitespace from every text field.
- Parse `week`, `exercise_order`, `source_pdf_page`, and `working_sets` as numbers.
- Keep `warmup_sets`, `reps`, `early_set_rpe`, `last_set_rpe`, and `rest` as strings.
- Convert blank strings to `undefined` for:
  - `last_set_intensity_technique`
  - `early_set_rpe`
- Build three exercise options from:
  - `exercise_name` + `exercise_video_url`
  - `substitution_option_1` + `substitution_option_1_video_url`
  - `substitution_option_2` + `substitution_option_2_video_url`
- Mark `exercise_name` as the default option.
- Build week groups from `week`.
- Build day groups inside each week from `workout_day_name`.
- Sort exercises inside a day by `exercise_order`.
- Derive day order from the fixed sequence `Upper`, `Lower`, `Pull`, `Push`, `Legs`.
- Build each option’s `historyKey` from a normalized version of that option label so the app can show the last logged weight for recurring movements across different weeks.
- Fail import with a readable error if required headers are missing or numeric fields cannot be parsed.

## MVP screens

### 1. Import screen

Shown when no program is loaded.

Content:

- short explanation that the app expects the bodybuilding transformation CSV format
- button: `Import Program CSV`
- small preview of expected headers or a note pointing to the included sample file
- readable import error state

Result:

- successful import stores the program and routes the user to the program home screen

### 2. Program home screen

This replaces the earlier flat workout-days home.

Content:

- title: `Program`
- active block label for the selected week
- horizontal week selector from 1 to 12
- list of the five workout days for the selected week
- each day row shows:
  - day name
  - focus
  - number of exercises
- secondary action: `Replace Program`
- secondary action: `Reset Data`

Result:

- tapping a day opens the workout-day detail screen

### 3. Workout day detail screen

Content:

- week number
- block
- day name
- focus
- ordered exercise cards

Each exercise card shows:

- prescribed exercise name
- prescribed video link
- substitution options
- warmup sets
- working sets
- reps
- RPE targets
- rest
- intensity technique if present
- notes
- latest logged weights summary if available

Interaction:

- default the logging UI to the prescribed option
- allow switching to one substitution option before saving
- expand the card or keep the logger inline
- render one weight input per working set
- save the exercise log in one action

### 4. Optional lightweight history line

Do not build a dedicated history screen in the MVP.

If needed, only show:

- latest log date
- latest working-set weights

That is enough for the first version.

## UX rules

- The shortest path should be: choose week, open day, log working weights.
- Avoid modal-heavy flows.
- Keep the day detail screen scrollable and card-based.
- Make video and substitution links obvious but secondary to the prescribed movement.
- Make the prescribed movement visually primary and substitutions clearly labeled as alternatives.
- Make weight entry fast enough to use between sets.
- Preserve unsaved draft input while the user stays on the screen.
- Default the app back to the last selected week after restart.

## Logging behavior

- Inputs accept free text such as `185`, `185 lb`, or `85 kg`.
- The MVP does not need unit conversion.
- Reps-completed logging is optional and should only be included if it does not slow down the main workflow.
- Saving an exercise appends a new log entry.
- The latest weights summary should come from the newest log with the same `historyKey`.
- The chosen movement option should be stored with the log so primary and substitution histories do not get mixed together.
- Logs should remain even if the user changes weeks.

## Replace and reset behavior

To keep the implementation simple:

- `Replace Program` imports a new CSV, replaces the current program, and clears logs.
- `Reset Data` clears both the imported program and all logs.

This is deliberate. Preserving logs across program-file changes adds mapping and migration complexity that is not worth it for the MVP.

## Technical approach

### Platform and app structure

- Keep Expo and React Native Web.
- Stay within the current lightweight project structure.
- Do not add backend infrastructure.
- Only add a navigation library if screen state becomes awkward in plain React state.

### Recommended libraries

- `expo-document-picker` for CSV import on iOS and web
- `papaparse` for CSV parsing
- `@react-native-async-storage/async-storage` for local persistence

Use built-in `Linking` for opening video URLs.

## Suggested component breakdown

- `App.tsx`
  - top-level app shell and high-level view switching
- `src/types.ts`
  - program and log types
- `src/lib/csv.ts`
  - exact-schema CSV parsing and normalization
- `src/lib/storage.ts`
  - Supabase persistence helpers
- `src/components/ImportProgram.tsx`
  - import action and error display
- `src/components/WeekPicker.tsx`
  - horizontal week selector
- `src/components/DayList.tsx`
  - workout-day list for the selected week
- `src/components/ExerciseCard.tsx`
  - exercise details and working-set logger

## Implementation phases

### Phase 1: import foundation

- add program and log TypeScript types
- add CSV parser for the exact 20-column format
- add program and log persistence
- add the empty-state import flow

### Phase 2: program browsing

- replace the current landing page with the program home screen
- add week selection
- add workout-day detail view
- display all key exercise metadata from the CSV

### Phase 3: working-set logging

- add inline working-set weight inputs
- save logs locally
- show latest logged weights by exercise name
- add replace/reset actions

### Phase 4: polish

- improve import validation messages
- refine responsive layout for web
- tighten tap targets and spacing for mid-workout use

## Acceptance criteria

- User can import the provided CSV format on iOS and web.
- App groups the imported program by week and workout day correctly.
- App shows the selected week’s block and workout days.
- App shows exercise data including the prescribed movement, substitutions, sets, reps, RPE, rest, technique, and notes.
- App lets the user log either the prescribed movement or one substitution for an exercise slot.
- App renders one weight input per planned working set.
- Saved working weights persist across app restarts and browser reloads.
- App shows the latest logged weights for recurring movement variations.
- User can replace or reset the program without backend support.

## Deliberate constraints

If a decision increases complexity without materially improving the workout flow, do not build it.

This app should stay a personal program viewer plus working-weight tracker. It should not grow into a generalized workout platform.

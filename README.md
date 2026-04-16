# nippard-plan

Expo gym app for iOS and web with Supabase-backed persistence.

## Commands

```bash
npm install
npm run build
npm run build:web
npm run web
npm run ios
npm run typecheck
npm run test
```

## Environment

Create a `.env` file with:

```bash
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

The app also accepts the same values under `NEXT_PUBLIC_*`, but Expo reads `EXPO_PUBLIC_*` directly.

## Supabase

The project is already set up for the linked Supabase project. To apply future schema changes:

```bash
supabase login
supabase link --project-ref zngpimqzgpuquinaquyf
supabase db push
```

Current remote storage shape:

- `public.gym_program_state` stores the full workout program as JSON.
- `public.gym_exercise_logs` stores each saved exercise log, including set-by-set weights and reps.
- The app uses a single shared `scope_id = 'default'` because there is no auth flow yet.

## App behavior

- Seeds the corrected bodybuilding transformation CSV on first launch.
- Reads and writes the active week, workout sessions, and exercise logs through Supabase only.
- Requires Supabase configuration and connectivity to load or mutate app data.
- Lets you replace the program CSV later from inside the app.
- Keeps history per performed movement variation, not just per workout slot.

## Project structure

```text
.
├── App.tsx
├── metro.config.js
└── src
    ├── assets
    ├── components
    ├── lib
    ├── theme.ts
    └── types.ts
```

## Verification

Run `npm run typecheck`, `npm run test`, and `npm run build:web` before shipping changes.

## Vercel deployment

This app is an Expo project that exports a static web bundle. For Vercel, the repo now includes `vercel.json` so Vercel runs `expo export -p web` and serves the generated `dist/` directory instead of trying to infer the app layout from the source tree.

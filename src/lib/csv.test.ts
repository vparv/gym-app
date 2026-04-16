import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { DAY_ORDER } from '../types';
import { EXPECTED_CSV_HEADERS, parseWorkoutProgram } from './csv';

const seedCsv = readFileSync(
  join(process.cwd(), 'src/assets/bodybuilding_transformation_workouts_corrected.csv'),
  'utf8'
);

describe('parseWorkoutProgram', () => {
  it('accepts the corrected workout CSV and builds the expected program shape', () => {
    const program = parseWorkoutProgram(seedCsv, 'seed.csv');

    expect(program.activeWeek).toBe(1);
    expect(program.sourceName).toBe('seed.csv');
    expect(program.weeks).toHaveLength(12);
    expect(program.weeks[0]?.days.map((day) => day.name)).toEqual(DAY_ORDER);
    expect(program.weeks[0]?.days[0]?.exercises[0]?.options).toHaveLength(3);
    expect(program.weeks[0]?.days[0]?.exercises[0]?.options[0]?.isPrimary).toBe(true);
  });

  it('handles blank optional values', () => {
    const csv = [
      EXPECTED_CSV_HEADERS.join(','),
      '1,Foundation Block,Upper,Strength Focus,1,4,Primary Lift,https://example.com/primary,Alt One,https://example.com/alt-1,Alt Two,https://example.com/alt-2,,2-3,2,6-8,,~7-8,3-5 min,Take the main cue seriously',
      '1,Foundation Block,Lower,Strength Focus,1,5,Lower Lift,https://example.com/lower,Alt One,https://example.com/lower-1,Alt Two,https://example.com/lower-2,,2,2,8-10,~7-8,~8-9,1-2 min,Lower note',
      '1,Foundation Block,Pull,Hypertrophy Focus,1,6,Pull Lift,https://example.com/pull,Alt One,https://example.com/pull-1,Alt Two,https://example.com/pull-2,,2,2,8-10,~7-8,~8-9,1-2 min,Pull note',
      '1,Foundation Block,Push,Hypertrophy Focus,1,7,Push Lift,https://example.com/push,Alt One,https://example.com/push-1,Alt Two,https://example.com/push-2,,2,2,8-10,~7-8,~8-9,1-2 min,Push note',
      '1,Foundation Block,Legs,Hypertrophy Focus,1,8,Leg Lift,https://example.com/legs,Alt One,https://example.com/legs-1,Alt Two,https://example.com/legs-2,,2,2,8-10,~7-8,~8-9,1-2 min,Leg note',
      '2,Foundation Block,Upper,Strength Focus,1,4,Upper Two,https://example.com/upper-two,Alt One,https://example.com/u2-1,Alt Two,https://example.com/u2-2,,2,2,8-10,~7-8,~8-9,1-2 min,Upper note',
      '2,Foundation Block,Lower,Strength Focus,1,5,Lower Two,https://example.com/lower-two,Alt One,https://example.com/l2-1,Alt Two,https://example.com/l2-2,,2,2,8-10,~7-8,~8-9,1-2 min,Lower note',
      '2,Foundation Block,Pull,Hypertrophy Focus,1,6,Pull Two,https://example.com/pull-two,Alt One,https://example.com/p2-1,Alt Two,https://example.com/p2-2,,2,2,8-10,~7-8,~8-9,1-2 min,Pull note',
      '2,Foundation Block,Push,Hypertrophy Focus,1,7,Push Two,https://example.com/push-two,Alt One,https://example.com/p2-1,Alt Two,https://example.com/p2-2,,2,2,8-10,~7-8,~8-9,1-2 min,Push note',
      '2,Foundation Block,Legs,Hypertrophy Focus,1,8,Leg Two,https://example.com/leg-two,Alt One,https://example.com/g2-1,Alt Two,https://example.com/g2-2,,2,2,8-10,~7-8,~8-9,1-2 min,Leg note',
      '3,Foundation Block,Upper,Strength Focus,1,4,Upper Three,https://example.com/upper-three,Alt One,https://example.com/u3-1,Alt Two,https://example.com/u3-2,,2,2,8-10,~7-8,~8-9,1-2 min,Upper note',
      '3,Foundation Block,Lower,Strength Focus,1,5,Lower Three,https://example.com/lower-three,Alt One,https://example.com/l3-1,Alt Two,https://example.com/l3-2,,2,2,8-10,~7-8,~8-9,1-2 min,Lower note',
      '3,Foundation Block,Pull,Hypertrophy Focus,1,6,Pull Three,https://example.com/pull-three,Alt One,https://example.com/p3-1,Alt Two,https://example.com/p3-2,,2,2,8-10,~7-8,~8-9,1-2 min,Pull note',
      '3,Foundation Block,Push,Hypertrophy Focus,1,7,Push Three,https://example.com/push-three,Alt One,https://example.com/p3-1,Alt Two,https://example.com/p3-2,,2,2,8-10,~7-8,~8-9,1-2 min,Push note',
      '3,Foundation Block,Legs,Hypertrophy Focus,1,8,Leg Three,https://example.com/leg-three,Alt One,https://example.com/g3-1,Alt Two,https://example.com/g3-2,,2,2,8-10,~7-8,~8-9,1-2 min,Leg note',
      '4,Foundation Block,Upper,Strength Focus,1,4,Upper Four,https://example.com/upper-four,Alt One,https://example.com/u4-1,Alt Two,https://example.com/u4-2,,2,2,8-10,~7-8,~8-9,1-2 min,Upper note',
      '4,Foundation Block,Lower,Strength Focus,1,5,Lower Four,https://example.com/lower-four,Alt One,https://example.com/l4-1,Alt Two,https://example.com/l4-2,,2,2,8-10,~7-8,~8-9,1-2 min,Lower note',
      '4,Foundation Block,Pull,Hypertrophy Focus,1,6,Pull Four,https://example.com/pull-four,Alt One,https://example.com/p4-1,Alt Two,https://example.com/p4-2,,2,2,8-10,~7-8,~8-9,1-2 min,Pull note',
      '4,Foundation Block,Push,Hypertrophy Focus,1,7,Push Four,https://example.com/push-four,Alt One,https://example.com/p4-1,Alt Two,https://example.com/p4-2,,2,2,8-10,~7-8,~8-9,1-2 min,Push note',
      '4,Foundation Block,Legs,Hypertrophy Focus,1,8,Leg Four,https://example.com/leg-four,Alt One,https://example.com/g4-1,Alt Two,https://example.com/g4-2,,2,2,8-10,~7-8,~8-9,1-2 min,Leg note',
      '5,Foundation Block,Upper,Strength Focus,1,4,Upper Five,https://example.com/upper-five,Alt One,https://example.com/u5-1,Alt Two,https://example.com/u5-2,,2,2,8-10,~7-8,~8-9,1-2 min,Upper note',
      '5,Foundation Block,Lower,Strength Focus,1,5,Lower Five,https://example.com/lower-five,Alt One,https://example.com/l5-1,Alt Two,https://example.com/l5-2,,2,2,8-10,~7-8,~8-9,1-2 min,Lower note',
      '5,Foundation Block,Pull,Hypertrophy Focus,1,6,Pull Five,https://example.com/pull-five,Alt One,https://example.com/p5-1,Alt Two,https://example.com/p5-2,,2,2,8-10,~7-8,~8-9,1-2 min,Pull note',
      '5,Foundation Block,Push,Hypertrophy Focus,1,7,Push Five,https://example.com/push-five,Alt One,https://example.com/p5-1,Alt Two,https://example.com/p5-2,,2,2,8-10,~7-8,~8-9,1-2 min,Push note',
      '5,Foundation Block,Legs,Hypertrophy Focus,1,8,Leg Five,https://example.com/leg-five,Alt One,https://example.com/g5-1,Alt Two,https://example.com/g5-2,,2,2,8-10,~7-8,~8-9,1-2 min,Leg note',
      '6,Ramping Block,Upper,Strength Focus,1,4,Upper Six,https://example.com/upper-six,Alt One,https://example.com/u6-1,Alt Two,https://example.com/u6-2,,2,2,8-10,~7-8,~8-9,1-2 min,Upper note',
      '6,Ramping Block,Lower,Strength Focus,1,5,Lower Six,https://example.com/lower-six,Alt One,https://example.com/l6-1,Alt Two,https://example.com/l6-2,,2,2,8-10,~7-8,~8-9,1-2 min,Lower note',
      '6,Ramping Block,Pull,Hypertrophy Focus,1,6,Pull Six,https://example.com/pull-six,Alt One,https://example.com/p6-1,Alt Two,https://example.com/p6-2,,2,2,8-10,~7-8,~8-9,1-2 min,Pull note',
      '6,Ramping Block,Push,Hypertrophy Focus,1,7,Push Six,https://example.com/push-six,Alt One,https://example.com/p6-1,Alt Two,https://example.com/p6-2,,2,2,8-10,~7-8,~8-9,1-2 min,Push note',
      '6,Ramping Block,Legs,Hypertrophy Focus,1,8,Leg Six,https://example.com/leg-six,Alt One,https://example.com/g6-1,Alt Two,https://example.com/g6-2,,2,2,8-10,~7-8,~8-9,1-2 min,Leg note',
      '7,Ramping Block,Upper,Strength Focus,1,4,Upper Seven,https://example.com/upper-seven,Alt One,https://example.com/u7-1,Alt Two,https://example.com/u7-2,,2,2,8-10,~7-8,~8-9,1-2 min,Upper note',
      '7,Ramping Block,Lower,Strength Focus,1,5,Lower Seven,https://example.com/lower-seven,Alt One,https://example.com/l7-1,Alt Two,https://example.com/l7-2,,2,2,8-10,~7-8,~8-9,1-2 min,Lower note',
      '7,Ramping Block,Pull,Hypertrophy Focus,1,6,Pull Seven,https://example.com/pull-seven,Alt One,https://example.com/p7-1,Alt Two,https://example.com/p7-2,,2,2,8-10,~7-8,~8-9,1-2 min,Pull note',
      '7,Ramping Block,Push,Hypertrophy Focus,1,7,Push Seven,https://example.com/push-seven,Alt One,https://example.com/p7-1,Alt Two,https://example.com/p7-2,,2,2,8-10,~7-8,~8-9,1-2 min,Push note',
      '7,Ramping Block,Legs,Hypertrophy Focus,1,8,Leg Seven,https://example.com/leg-seven,Alt One,https://example.com/g7-1,Alt Two,https://example.com/g7-2,,2,2,8-10,~7-8,~8-9,1-2 min,Leg note',
      '8,Ramping Block,Upper,Strength Focus,1,4,Upper Eight,https://example.com/upper-eight,Alt One,https://example.com/u8-1,Alt Two,https://example.com/u8-2,,2,2,8-10,~7-8,~8-9,1-2 min,Upper note',
      '8,Ramping Block,Lower,Strength Focus,1,5,Lower Eight,https://example.com/lower-eight,Alt One,https://example.com/l8-1,Alt Two,https://example.com/l8-2,,2,2,8-10,~7-8,~8-9,1-2 min,Lower note',
      '8,Ramping Block,Pull,Hypertrophy Focus,1,6,Pull Eight,https://example.com/pull-eight,Alt One,https://example.com/p8-1,Alt Two,https://example.com/p8-2,,2,2,8-10,~7-8,~8-9,1-2 min,Pull note',
      '8,Ramping Block,Push,Hypertrophy Focus,1,7,Push Eight,https://example.com/push-eight,Alt One,https://example.com/p8-1,Alt Two,https://example.com/p8-2,,2,2,8-10,~7-8,~8-9,1-2 min,Push note',
      '8,Ramping Block,Legs,Hypertrophy Focus,1,8,Leg Eight,https://example.com/leg-eight,Alt One,https://example.com/g8-1,Alt Two,https://example.com/g8-2,,2,2,8-10,~7-8,~8-9,1-2 min,Leg note',
      '9,Ramping Block,Upper,Strength Focus,1,4,Upper Nine,https://example.com/upper-nine,Alt One,https://example.com/u9-1,Alt Two,https://example.com/u9-2,,2,2,8-10,~7-8,~8-9,1-2 min,Upper note',
      '9,Ramping Block,Lower,Strength Focus,1,5,Lower Nine,https://example.com/lower-nine,Alt One,https://example.com/l9-1,Alt Two,https://example.com/l9-2,,2,2,8-10,~7-8,~8-9,1-2 min,Lower note',
      '9,Ramping Block,Pull,Hypertrophy Focus,1,6,Pull Nine,https://example.com/pull-nine,Alt One,https://example.com/p9-1,Alt Two,https://example.com/p9-2,,2,2,8-10,~7-8,~8-9,1-2 min,Pull note',
      '9,Ramping Block,Push,Hypertrophy Focus,1,7,Push Nine,https://example.com/push-nine,Alt One,https://example.com/p9-1,Alt Two,https://example.com/p9-2,,2,2,8-10,~7-8,~8-9,1-2 min,Push note',
      '9,Ramping Block,Legs,Hypertrophy Focus,1,8,Leg Nine,https://example.com/leg-nine,Alt One,https://example.com/g9-1,Alt Two,https://example.com/g9-2,,2,2,8-10,~7-8,~8-9,1-2 min,Leg note',
      '10,Ramping Block,Upper,Strength Focus,1,4,Upper Ten,https://example.com/upper-ten,Alt One,https://example.com/u10-1,Alt Two,https://example.com/u10-2,,2,2,8-10,~7-8,~8-9,1-2 min,Upper note',
      '10,Ramping Block,Lower,Strength Focus,1,5,Lower Ten,https://example.com/lower-ten,Alt One,https://example.com/l10-1,Alt Two,https://example.com/l10-2,,2,2,8-10,~7-8,~8-9,1-2 min,Lower note',
      '10,Ramping Block,Pull,Hypertrophy Focus,1,6,Pull Ten,https://example.com/pull-ten,Alt One,https://example.com/p10-1,Alt Two,https://example.com/p10-2,,2,2,8-10,~7-8,~8-9,1-2 min,Pull note',
      '10,Ramping Block,Push,Hypertrophy Focus,1,7,Push Ten,https://example.com/push-ten,Alt One,https://example.com/p10-1,Alt Two,https://example.com/p10-2,,2,2,8-10,~7-8,~8-9,1-2 min,Push note',
      '10,Ramping Block,Legs,Hypertrophy Focus,1,8,Leg Ten,https://example.com/leg-ten,Alt One,https://example.com/g10-1,Alt Two,https://example.com/g10-2,,2,2,8-10,~7-8,~8-9,1-2 min,Leg note',
      '11,Ramping Block,Upper,Strength Focus,1,4,Upper Eleven,https://example.com/upper-eleven,Alt One,https://example.com/u11-1,Alt Two,https://example.com/u11-2,,2,2,8-10,~7-8,~8-9,1-2 min,Upper note',
      '11,Ramping Block,Lower,Strength Focus,1,5,Lower Eleven,https://example.com/lower-eleven,Alt One,https://example.com/l11-1,Alt Two,https://example.com/l11-2,,2,2,8-10,~7-8,~8-9,1-2 min,Lower note',
      '11,Ramping Block,Pull,Hypertrophy Focus,1,6,Pull Eleven,https://example.com/pull-eleven,Alt One,https://example.com/p11-1,Alt Two,https://example.com/p11-2,,2,2,8-10,~7-8,~8-9,1-2 min,Pull note',
      '11,Ramping Block,Push,Hypertrophy Focus,1,7,Push Eleven,https://example.com/push-eleven,Alt One,https://example.com/p11-1,Alt Two,https://example.com/p11-2,,2,2,8-10,~7-8,~8-9,1-2 min,Push note',
      '11,Ramping Block,Legs,Hypertrophy Focus,1,8,Leg Eleven,https://example.com/leg-eleven,Alt One,https://example.com/g11-1,Alt Two,https://example.com/g11-2,,2,2,8-10,~7-8,~8-9,1-2 min,Leg note',
      '12,Ramping Block,Upper,Strength Focus,1,4,Upper Twelve,https://example.com/upper-twelve,Alt One,https://example.com/u12-1,Alt Two,https://example.com/u12-2,,2,2,8-10,~7-8,~8-9,1-2 min,Upper note',
      '12,Ramping Block,Lower,Strength Focus,1,5,Lower Twelve,https://example.com/lower-twelve,Alt One,https://example.com/l12-1,Alt Two,https://example.com/l12-2,,2,2,8-10,~7-8,~8-9,1-2 min,Lower note',
      '12,Ramping Block,Pull,Hypertrophy Focus,1,6,Pull Twelve,https://example.com/pull-twelve,Alt One,https://example.com/p12-1,Alt Two,https://example.com/p12-2,,2,2,8-10,~7-8,~8-9,1-2 min,Pull note',
      '12,Ramping Block,Push,Hypertrophy Focus,1,7,Push Twelve,https://example.com/push-twelve,Alt One,https://example.com/p12-1,Alt Two,https://example.com/p12-2,,2,2,8-10,~7-8,~8-9,1-2 min,Push note',
      '12,Ramping Block,Legs,Hypertrophy Focus,1,8,Leg Twelve,https://example.com/leg-twelve,Alt One,https://example.com/g12-1,Alt Two,https://example.com/g12-2,,2,2,8-10,~7-8,~8-9,1-2 min,Leg note',
    ].join('\n');

    const program = parseWorkoutProgram(csv, 'blank-optional.csv');
    const exercise = program.weeks[0]?.days[0]?.exercises[0];

    expect(exercise?.earlySetRpeText).toBeUndefined();
    expect(exercise?.lastSetIntensityTechnique).toBeUndefined();
  });

  it('rejects missing headers', () => {
    const csv = 'week,block\n1,Foundation Block';

    expect(() => parseWorkoutProgram(csv, 'invalid.csv')).toThrow(/header/i);
  });

  it('rejects non-numeric required fields', () => {
    const invalidCsv = seedCsv.replace(
      '1,Foundation Block,Upper,Strength Focus,1,4,',
      'abc,Foundation Block,Upper,Strength Focus,1,4,'
    );

    expect(() => parseWorkoutProgram(invalidCsv, 'invalid.csv')).toThrow(/week/i);
  });

  it('rejects inconsistent day-level fields', () => {
    const lines = seedCsv.split('\n');
    const inconsistentLine = lines[2]?.replace('Strength Focus', 'Hypertrophy Focus');
    lines[2] = inconsistentLine;

    expect(() => parseWorkoutProgram(lines.join('\n'), 'inconsistent.csv')).toThrow(/inconsistent focus/i);
  });
});

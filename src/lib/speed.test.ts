import { describe, expect, it } from 'vitest';
import { canStepSpeed, clampSpeed, MAX_SPEED, MIN_SPEED, stepSpeed } from './speed';

describe('clampSpeed', () => {
  it('keeps a speed in range as it is', () => {
    expect(clampSpeed(1.5)).toBe(1.5);
  });

  it('brings a speed outside the range to its edge', () => {
    expect(clampSpeed(0.1)).toBe(MIN_SPEED);
    expect(clampSpeed(16)).toBe(MAX_SPEED);
  });
});

describe('stepSpeed', () => {
  it('moves 0.25 up or down from a step', () => {
    expect(stepSpeed(2, 1)).toBe(2.25);
    expect(stepSpeed(2, -1)).toBe(1.75);
  });

  it('moves a speed between steps to the nearest step in that direction', () => {
    expect(stepSpeed(1.1, 1)).toBe(1.25);
    expect(stepSpeed(1.1, -1)).toBe(1);
  });

  it('treats a value a float error off a step as that step', () => {
    expect(stepSpeed(0.1 + 0.2 + 0.7, 1)).toBe(1.25);
    expect(stepSpeed(1.0000000001, -1)).toBe(0.75);
  });

  it('stops at the ends of the range', () => {
    expect(stepSpeed(MAX_SPEED, 1)).toBe(MAX_SPEED);
    expect(stepSpeed(MIN_SPEED, -1)).toBe(MIN_SPEED);
    expect(stepSpeed(3.9, 1)).toBe(MAX_SPEED);
    expect(stepSpeed(16, -1)).toBe(MAX_SPEED);
  });

  it('walks every step from one end of the range to the other', () => {
    const steps = [MIN_SPEED];
    while (canStepSpeed(steps.at(-1)!, 1)) steps.push(stepSpeed(steps.at(-1)!, 1));
    expect(steps).toHaveLength(16);
    expect(steps.at(-1)).toBe(MAX_SPEED);
  });
});

describe('canStepSpeed', () => {
  it('is false only at the end of the range it would move past', () => {
    expect(canStepSpeed(MAX_SPEED, 1)).toBe(false);
    expect(canStepSpeed(MAX_SPEED, -1)).toBe(true);
    expect(canStepSpeed(MIN_SPEED, -1)).toBe(false);
    expect(canStepSpeed(MIN_SPEED, 1)).toBe(true);
  });
});

/** The default speed on install (SPEC §3.1). */
export const INSTALL_DEFAULT_SPEED = 2;

/**
 * The speed range (SPEC §3.1). Firefox mutes audio outside it (SPEC §2.2), so every control
 * stops there.
 */
export const MIN_SPEED = 0.25;
export const MAX_SPEED = 4;

/** One step of a speed control: the popup's −/+, and the shortcuts in Phase 2 (ADR-0005). */
export const SPEED_STEP = 0.25;

/** Whether `value` is a speed the default can be set to. */
export function isValidSpeed(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= MIN_SPEED && value <= MAX_SPEED;
}

/** `speed` brought into the range. */
export function clampSpeed(speed: number): number {
  return Math.min(MAX_SPEED, Math.max(MIN_SPEED, speed));
}

/**
 * The next speed one step up (`1`) or down (`-1`) from `speed`. A speed between steps (a site
 * may have set 1.1) moves to the nearest step in that direction, so the result is always a
 * step within the range.
 */
export function stepSpeed(speed: number, direction: 1 | -1): number {
  const steps = speed / SPEED_STEP;
  // The epsilon keeps a value a hair off a step, from float arithmetic, on that step.
  const next = direction > 0 ? Math.floor(steps + 1e-9) + 1 : Math.ceil(steps - 1e-9) - 1;
  return clampSpeed(next * SPEED_STEP);
}

/** Whether `speed` can move a step in `direction`. */
export function canStepSpeed(speed: number, direction: 1 | -1): boolean {
  return direction > 0 ? speed < MAX_SPEED : speed > MIN_SPEED;
}

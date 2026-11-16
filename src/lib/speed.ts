/** The default speed on install (SPEC §3.1). */
export const INSTALL_DEFAULT_SPEED = 2;

/** The range of the default speed (SPEC §3.1). The popup's steps arrive with #4. */
export const MIN_SPEED = 0.25;
export const MAX_SPEED = 4;

/** Whether `value` is a speed the default can be set to. */
export function isValidSpeed(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= MIN_SPEED && value <= MAX_SPEED;
}

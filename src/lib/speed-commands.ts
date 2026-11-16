/**
 * Our speed controls (SPEC §1, §3.2 rule 5, ADR-0005): the three shortcut commands, the message
 * that carries one to every frame in a tab, and the speed each command moves a video to. The
 * popup's −/+ sends the same message.
 */
import { stepSpeed } from './speed';

/** The `commands` in the manifest. Users rebind them by these names, so they never change. */
export const SPEED_COMMANDS = ['speed-up', 'slow-down', 'toggle-speed'] as const;
export type SpeedCommand = (typeof SPEED_COMMANDS)[number];

export function isSpeedCommand(value: unknown): value is SpeedCommand {
  return SPEED_COMMANDS.includes(value as SpeedCommand);
}

/** Sent to every frame in a tab; each frame applies it to its own videos. */
export interface SpeedCommandMessage {
  type: 'speedCommand';
  command: SpeedCommand;
}

export function speedCommandMessage(command: SpeedCommand): SpeedCommandMessage {
  return { type: 'speedCommand', command };
}

export function isSpeedCommandMessage(message: unknown): message is SpeedCommandMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as { type?: unknown }).type === 'speedCommand' &&
    isSpeedCommand((message as { command?: unknown }).command)
  );
}

/**
 * The speed a video playing at `speed` moves to. Up and down go one step from the video's own
 * speed. The toggle sends any speed other than 1× to 1×, and 1× to the default.
 */
export function commandedSpeed(command: SpeedCommand, speed: number, defaultSpeed: number): number {
  switch (command) {
    case 'speed-up':
      return stepSpeed(speed, 1);
    case 'slow-down':
      return stepSpeed(speed, -1);
    case 'toggle-speed':
      // The epsilon keeps a 1× that picked up a float error, from a site's own arithmetic, at 1×.
      return Math.abs(speed - 1) < 1e-9 ? defaultSpeed : 1;
  }
}

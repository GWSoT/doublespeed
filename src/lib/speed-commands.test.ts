import { describe, expect, it } from 'vitest';
import { commandedSpeed, isSpeedCommand, isSpeedCommandMessage, speedCommandMessage } from './speed-commands';
import { MAX_SPEED, MIN_SPEED } from './speed';

const DEFAULT = 2;

describe('commandedSpeed', () => {
  it('speed-up and slow-down move one step from the video’s own speed', () => {
    expect(commandedSpeed('speed-up', 2, DEFAULT)).toBe(2.25);
    expect(commandedSpeed('slow-down', 2, DEFAULT)).toBe(1.75);
    expect(commandedSpeed('speed-up', 1.5, DEFAULT)).toBe(1.75);
  });

  it('a speed a site set between steps moves to the nearest step in that direction', () => {
    expect(commandedSpeed('speed-up', 1.1, DEFAULT)).toBe(1.25);
    expect(commandedSpeed('slow-down', 1.1, DEFAULT)).toBe(1);
  });

  it('stops at the ends of the range', () => {
    expect(commandedSpeed('speed-up', MAX_SPEED, DEFAULT)).toBe(MAX_SPEED);
    expect(commandedSpeed('slow-down', MIN_SPEED, DEFAULT)).toBe(MIN_SPEED);
    // A speed outside the range, set by a site, comes back into it.
    expect(commandedSpeed('slow-down', 8, DEFAULT)).toBe(MAX_SPEED);
  });

  it('toggle-speed sends any speed other than 1× to 1×, and 1× to the default', () => {
    expect(commandedSpeed('toggle-speed', 2, DEFAULT)).toBe(1);
    expect(commandedSpeed('toggle-speed', 1.5, DEFAULT)).toBe(1);
    expect(commandedSpeed('toggle-speed', 0.5, DEFAULT)).toBe(1);
    expect(commandedSpeed('toggle-speed', 1, DEFAULT)).toBe(DEFAULT);
    expect(commandedSpeed('toggle-speed', 1, 3)).toBe(3);
    expect(commandedSpeed('toggle-speed', 1.0000000001, DEFAULT)).toBe(DEFAULT);
  });
});

describe('the command message', () => {
  it('round-trips each command', () => {
    for (const command of ['speed-up', 'slow-down', 'toggle-speed'] as const) {
      expect(isSpeedCommand(command)).toBe(true);
      expect(isSpeedCommandMessage(speedCommandMessage(command))).toBe(true);
    }
  });

  it('rejects anything else', () => {
    expect(isSpeedCommand('_execute_action')).toBe(false);
    expect(isSpeedCommandMessage({ type: 'speedCommand', command: 'faster' })).toBe(false);
    expect(isSpeedCommandMessage({ type: 'getPageSite' })).toBe(false);
    expect(isSpeedCommandMessage(null)).toBe(false);
    expect(isSpeedCommandMessage('speed-up')).toBe(false);
  });
});

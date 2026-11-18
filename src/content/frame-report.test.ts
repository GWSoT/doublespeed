import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FrameState, FrameStateMessage } from '../lib/tab-speed';
import { reportFrame } from './frame-report';

const VIDEO: FrameState = { off: false, video: { speed: 2, playing: false, playedAt: 0 } };

type Listener = (message: unknown, sender: unknown, sendResponse: (answer: unknown) => void) => void;

let sent: FrameStateMessage[];
let listener: Listener | undefined;

/** A window and document for one frame; `prerendering` as Chrome sets it. */
function fakeWindow({ prerendering = false } = {}) {
  const document = Object.assign(new EventTarget(), { prerendering });
  return Object.assign(new EventTarget(), { document });
}

/** What the frame answers when the background asks which document it holds. */
function ask(): unknown {
  let answer: unknown = 'no answer';
  listener?.({ type: 'frameDoc' }, {}, (value) => (answer = value));
  return answer;
}

const pageshow = (persisted: boolean) => Object.assign(new Event('pageshow'), { persisted });
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  sent = [];
  listener = undefined;
  vi.stubGlobal('browser', {
    runtime: {
      sendMessage: async (message: FrameStateMessage) => void sent.push(message),
      onMessage: {
        addListener: (l: Listener) => (listener = l),
        removeListener: (l: Listener) => {
          if (listener === l) listener = undefined;
        },
      },
    },
  });
});

afterEach(() => vi.unstubAllGlobals());

function start(state: FrameState | null, options?: { prerendering?: boolean }) {
  const win = fakeWindow(options);
  const controller = new AbortController();
  let current = state;
  const reporter = reportFrame(() => current, controller.signal, win as unknown as Window);
  return {
    win,
    controller,
    reporter,
    set(next: FrameState | null) {
      current = next;
      reporter.changed();
    },
  };
}

describe('reportFrame', () => {
  it('sends nothing from a frame with nothing to show, and a report only when it changes', async () => {
    const frame = start(null);
    frame.reporter.changed();
    await tick();
    expect(sent).toEqual([]);

    frame.set(VIDEO);
    frame.reporter.changed();
    await tick();
    expect(sent).toEqual([{ type: 'frameState', doc: expect.any(String), state: VIDEO }]);
  });

  it('answers the background with the document id its reports carry', async () => {
    const frame = start(null);
    frame.set(VIDEO);
    await tick();
    expect(ask()).toBe(sent[0]!.doc);
  });

  it('withdraws its report on pagehide, then answers null and sends nothing', async () => {
    const frame = start(null);
    frame.set(VIDEO);
    await tick();
    const { doc } = sent[0]!;

    frame.win.dispatchEvent(new Event('pagehide'));
    expect(sent[1]).toEqual({ type: 'frameState', doc, state: null });
    expect(ask()).toBeNull();
    frame.set({ ...VIDEO, video: { ...VIDEO.video!, speed: 3 } });
    await tick();
    expect(sent).toHaveLength(2);
  });

  it('back from the back/forward cache, reports again under a new document id', async () => {
    const frame = start(null);
    frame.set(VIDEO);
    await tick();
    const before = sent[0]!.doc;
    frame.win.dispatchEvent(new Event('pagehide'));

    frame.win.dispatchEvent(pageshow(false));
    await tick();
    expect(sent).toHaveLength(2);

    frame.win.dispatchEvent(pageshow(true));
    await tick();
    expect(sent[2]).toEqual({ type: 'frameState', doc: expect.any(String), state: VIDEO });
    expect(sent[2]!.doc).not.toBe(before);
    expect(ask()).toBe(sent[2]!.doc);
  });

  it('back from the cache without the pagehide a page script stopped, still reports under its new id', async () => {
    const frame = start(null);
    frame.set(VIDEO);
    await tick();
    const before = sent[0]!.doc;

    frame.win.dispatchEvent(pageshow(true));
    await tick();
    expect(sent).toHaveLength(2);
    expect(sent[1]).toEqual({ type: 'frameState', doc: expect.any(String), state: VIDEO });
    expect(sent[1]!.doc).not.toBe(before);
    expect(ask()).toBe(sent[1]!.doc);
  });

  it('sends nothing while the page is prerendered, and its report once it’s shown', async () => {
    const frame = start(VIDEO, { prerendering: true });
    frame.reporter.changed();
    await tick();
    expect(sent).toEqual([]);

    frame.win.document.prerendering = false;
    frame.win.document.dispatchEvent(new Event('prerenderingchange'));
    await tick();
    expect(sent).toEqual([{ type: 'frameState', doc: expect.any(String), state: VIDEO }]);
  });

  it('stops answering once the content script is gone', async () => {
    const frame = start(VIDEO);
    frame.controller.abort();
    expect(ask()).toBe('no answer');
  });
});

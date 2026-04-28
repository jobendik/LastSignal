import { EventBus } from '../core/EventBus';

/**
 * Global event bus event map. Every cross-system event flows through here.
 */
export interface GameEvents {
  // Scene / meta
  'scene:change':          { from: string; to: string };
  'settings:changed':      { master: number; sfx: number; music: number; reducedMotion: boolean };

  // Interaction
  'hover:changed':         { id: string | null; label?: string; hint?: string };
  'focus:entered':         { id: string };
  'focus:exited':          { id: string };
  'inspect:entered':       { id: string };
  'inspect:exited':        { id: string };

  // Tape deck / audio
  'tape:inserted':         { tapeId: string };
  'tape:ejected':          { tapeId: string };
  'tape:playStateChanged': { playing: boolean; rate: number; reversed: boolean };
  'tape:timeChanged':      { time: number; duration: number };
  'audio:filtersChanged':  { lowpass: number; highpass: number; bandpass: number; q: number; gain: number; bandpassEnabled: boolean };

  // Clues / puzzle / documents
  'clue:discovered':       { id: string; title: string; description: string; source: string };
  'document:read':         { id: string };
  'puzzle:stepComplete':   { stepId: string };
  'code:attempted':        { code: string; correct: boolean };
  'drawer:unlocked':       {};
  'objective:changed':     { id: string; text: string };

  // Ending
  'ending:triggered':      {};
  'ending:complete':       {};

  // UI
  'ui:notebookToggle':     { open?: boolean };
  'ui:pauseToggle':        { paused?: boolean };
  'ui:debugToggle':        { open?: boolean };
}

export const Events = new EventBus<GameEvents & Record<string, unknown>>();

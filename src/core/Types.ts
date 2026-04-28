/**
 * Central type declarations shared by multiple systems.
 */

export type InteractableId = string;
export type ClueId = string;
export type DocumentId = string;
export type TapeId = string;
export type PuzzleStepId = string;

export type SceneName = 'boot' | 'menu' | 'investigation' | 'ending';

/** Interaction categories used by the raycast/focus system. */
export type InteractionKind =
  | 'device'     // focus mode + device HUD
  | 'document'   // open a readable
  | 'cassette'   // pick up / insert / eject
  | 'container'  // open code panel
  | 'inspect';   // rotate/zoom only

export interface HoverInfo {
  id: InteractableId;
  kind: InteractionKind;
  label: string;
  hint?: string;
}

export interface DocumentData {
  id: DocumentId;
  title: string;
  meta?: string;
  body: string;
  signature?: string;
  stamp?: string;
  clueId?: ClueId;
}

export interface ClueData {
  id: ClueId;
  title: string;
  description: string;
  source: string;
  unlocks?: PuzzleStepId[];
}

export interface TapeDefinition {
  id: TapeId;
  title: string;
  label: string;
  duration: number;
  /** Color for the spine — used by placeholder cassette model. */
  color: string;
  /** Procedural audio generation spec. */
  spec: TapeAudioSpec;
  /** Hint shown in the notebook/HUD when inserted. */
  hint?: string;
}

export interface TapeAudioSpec {
  kind: 'pulses' | 'reversed' | 'tones';
  baseNoise: number;           // 0..1
  seed: number;
  /** For pulses: digit hidden as N pulses in center section. */
  pulseCount?: number;
  /** For tones: hidden frequency that must be isolated by band-pass. */
  hiddenFrequencyHz?: number;
  /** For reversed: the spoken digit (0..9). */
  reversedDigit?: number;
}

export type ObjectiveId =
  | 'start'
  | 'find-tapes'
  | 'decode-pulses'
  | 'decode-reversed'
  | 'decode-tones'
  | 'enter-code'
  | 'play-final'
  | 'ending';

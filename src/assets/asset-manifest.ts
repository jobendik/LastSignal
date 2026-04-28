/**
 * Centralised asset manifest.
 *
 * Every asset reference in the game passes through this manifest. Each entry
 * describes a *production* path (which is optional) and a *placeholder* kind
 * that the runtime knows how to synthesize procedurally.
 *
 * To ship production assets, drop files into /public/assets/... and change
 * the entry's `placeholder` to `'file'` (or remove the flag — the loader
 * will prefer the file when it resolves successfully).
 */

export type PlaceholderModel    = 'procedural';
export type PlaceholderTexture  = 'generated-paper' | 'generated-noise' | 'none';
export type PlaceholderAudio    = 'procedural-audio' | 'generated-click' | 'generated-tone' | 'generated-noise';

export interface ModelEntry   { placeholder: PlaceholderModel;    productionPath?: string; }
export interface TextureEntry { placeholder: PlaceholderTexture;  productionPath?: string; }
export interface AudioEntry   { placeholder: PlaceholderAudio;    productionPath?: string; }

export const AssetManifest = {
  models: {
    room:           { placeholder: 'procedural', productionPath: '/assets/models/environment/room.glb' },
    desk:           { placeholder: 'procedural', productionPath: '/assets/models/environment/desk.glb' },
    tapeDeck:       { placeholder: 'procedural', productionPath: '/assets/models/devices/tape_deck.glb' },
    oscilloscope:   { placeholder: 'procedural', productionPath: '/assets/models/devices/oscilloscope.glb' },
    audioProcessor: { placeholder: 'procedural', productionPath: '/assets/models/devices/audio_processor.glb' },
    lamp:           { placeholder: 'procedural', productionPath: '/assets/models/props/lamp.glb' },
    drawer:         { placeholder: 'procedural', productionPath: '/assets/models/props/drawer.glb' },
    cassetteA:      { placeholder: 'procedural', productionPath: '/assets/models/props/cassette_a.glb' },
    cassetteB:      { placeholder: 'procedural', productionPath: '/assets/models/props/cassette_b.glb' },
    cassetteC:      { placeholder: 'procedural', productionPath: '/assets/models/props/cassette_c.glb' },
    cassetteFinal:  { placeholder: 'procedural', productionPath: '/assets/models/props/cassette_final.glb' },
    document:       { placeholder: 'procedural', productionPath: '/assets/models/props/paper.glb' },
  } satisfies Record<string, ModelEntry>,

  textures: {
    paperNote:      { placeholder: 'generated-paper', productionPath: '/assets/textures/documents/paper.webp' },
    dust:           { placeholder: 'generated-noise', productionPath: '/assets/textures/environment/dust.webp' },
    scanline:       { placeholder: 'generated-noise', productionPath: '/assets/textures/devices/scanline.webp' },
  } satisfies Record<string, TextureEntry>,

  audio: {
    tapeA:          { placeholder: 'procedural-audio', productionPath: '/assets/audio/tapes/tape_a.ogg' },
    tapeB:          { placeholder: 'procedural-audio', productionPath: '/assets/audio/tapes/tape_b.ogg' },
    tapeC:          { placeholder: 'procedural-audio', productionPath: '/assets/audio/tapes/tape_c.ogg' },
    tapeFinal:      { placeholder: 'procedural-audio', productionPath: '/assets/audio/tapes/tape_final.ogg' },
    roomTone:       { placeholder: 'generated-noise',  productionPath: '/assets/audio/ambience/room_tone.ogg' },
    hum:            { placeholder: 'generated-tone',   productionPath: '/assets/audio/ambience/electrical_hum.ogg' },
    hiss:           { placeholder: 'generated-noise',  productionPath: '/assets/audio/ambience/tape_hiss.ogg' },
    buttonClick:    { placeholder: 'generated-click',  productionPath: '/assets/audio/sfx/button_click.wav' },
    knobTurn:       { placeholder: 'generated-click',  productionPath: '/assets/audio/sfx/knob_turn.wav' },
    cassetteInsert: { placeholder: 'generated-click',  productionPath: '/assets/audio/sfx/cassette_insert.wav' },
    cassetteEject:  { placeholder: 'generated-click',  productionPath: '/assets/audio/sfx/cassette_eject.wav' },
    drawerUnlock:   { placeholder: 'generated-click',  productionPath: '/assets/audio/sfx/drawer_unlock.wav' },
    wrongCode:      { placeholder: 'generated-tone',   productionPath: '/assets/audio/sfx/wrong_code.wav' },
    correctCode:    { placeholder: 'generated-tone',   productionPath: '/assets/audio/sfx/correct_code.wav' },
    clueDiscover:   { placeholder: 'generated-tone',   productionPath: '/assets/audio/sfx/clue.wav' },
    stinger:        { placeholder: 'generated-tone',   productionPath: '/assets/audio/sfx/stinger.wav' },
  } satisfies Record<string, AudioEntry>,
} as const;

export type ModelKey   = keyof typeof AssetManifest.models;
export type TextureKey = keyof typeof AssetManifest.textures;
export type AudioKey   = keyof typeof AssetManifest.audio;

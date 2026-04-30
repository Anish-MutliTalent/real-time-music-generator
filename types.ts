
export interface WeightedPrompt {
  id: string;
  text: string;
  weight: number;
  color: string;
  isActive: boolean;
}

export interface MusicGenerationConfig {
  bpm: number;
  scale?: string; // e.g. "C_MAJOR", "A_MINOR"
  temperature: number;
  density: number; // 0.0 to 1.0
  brightness: number; // 0.0 to 1.0
  mute_drums: boolean;
  mute_bass: boolean;
  only_bass_and_drums: boolean;
}

// Defining the shape of the experimental Lyria API based on user request
export interface LyriaSession {
  setWeightedPrompts: (args: { weightedPrompts: { text: string; weight: number }[] }) => Promise<void>;
  setMusicGenerationConfig: (args: { musicGenerationConfig: MusicGenerationConfig }) => Promise<void>;
  // Support both potential naming conventions for the alpha SDK
  reset_context?: () => Promise<void>;
  resetContext?: () => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>; 
  close: () => Promise<void>;
}

export type MacroValue = number | 'auto';

export interface MacroState {
  density: MacroValue;
  brightness: MacroValue;
  chaos: MacroValue;
  bpm: MacroValue;
  key: string | 'auto';
}

export interface InstrumentState {
  drums: boolean;
  bass: boolean;
  other: boolean;
}

export interface VisualizerChunk {
  id: string;
  data: Float32Array; // Interleaved Min/Max values
  startTime: number;
  duration: number;
  receivedAt: number; // For animation
}

export interface VisualizerEvent {
  type: 'chunk' | 'reset' | 'trim';
  chunk?: VisualizerChunk;
  time?: number; // Used for 'trim' event to specify cutoff
}

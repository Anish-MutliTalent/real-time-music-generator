
import { GoogleGenAI } from "@google/genai";
import { API_KEY, SAMPLE_RATE } from "../constants";
import { LyriaSession, MusicGenerationConfig, WeightedPrompt, VisualizerEvent, VisualizerChunk } from "../types";

class MusicService {
  private client: GoogleGenAI;
  private session: LyriaSession | null = null;
  private audioContext: AudioContext | null = null;
  private nextStartTime: number = 0;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private isConnected: boolean = false;
  
  // Track specific scheduled items to allow trimming
  private scheduledAudio: Array<{
    source: AudioBufferSourceNode;
    startTime: number;
    duration: number;
    id: string;
  }> = [];

  // Keep a history of buffers delivered so we can export them later
  private recordedBuffers: Array<{
    buffer: AudioBuffer;
    startTime: number;
    duration: number;
    id: string;
  }> = [];

  // Group recorded buffers into playback sessions. Each playback session represents
  // one continuous play (from play -> pause or until reset). Most sessions will
  // contain multiple chunks but are exported/edited as a single track.
  private sessions: Array<{
    id: string;
    startTime: number;
    endTime: number | null;
    buffers: Array<{ buffer: AudioBuffer; startTime: number; duration: number; id: string }>;
  }> = [];

  private currentSession: {
    id: string;
    startTime: number;
    endTime: number | null;
    buffers: Array<{ buffer: AudioBuffer; startTime: number; duration: number; id: string }>;
  } | null = null;

  private isSimulation: boolean = false;
  private simulationInterval: number | null = null;
  private activeNodes: AudioNode[] = [];
  
  private listeners: Set<(event: VisualizerEvent) => void> = new Set();

  private currentConfig: MusicGenerationConfig = {
      bpm: 100,
      scale: 'C_MAJOR_A_MINOR',
      temperature: 1.1,
      density: 0.5,
      brightness: 0.5,
      mute_drums: false,
      mute_bass: false,
      only_bass_and_drums: false
  };

  constructor() {
    this.client = new GoogleGenAI({
      apiKey: API_KEY,
      apiVersion: "v1alpha",
    });
  }

  private initAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: SAMPLE_RATE,
      });
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048; 
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
    }
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }
  
  public getCurrentTime(): number {
      return this.audioContext?.currentTime || 0;
  }

  public subscribe(callback: (event: VisualizerEvent) => void): () => void {
      this.listeners.add(callback);
      return () => this.listeners.delete(callback);
  }

  private emit(event: VisualizerEvent) {
      this.listeners.forEach(cb => cb(event));
  }

  public async connect(): Promise<void> {
    if (this.isConnected) return;
    this.initAudioContext();

    try {
      const musicClient = (this.client as any).live?.music;
      
      if (musicClient && API_KEY) {
        console.log("Connecting to Lyria model...");
        try {
            this.session = await musicClient.connect({
                model: "models/lyria-realtime-exp",
                callbacks: {
                  onmessage: (message: any) => {
                      if (message.serverContent?.audioChunks) {
                        for (const chunk of message.serverContent.audioChunks) {
                            this.scheduleAudioChunk(chunk.data);
                        }
                      }
                  },
                  onerror: (error: any) => console.error("Music session error:", error),
                  onclose: () => {
                      console.log("Lyria RealTime stream closed.");
                      this.isConnected = false;
                  },
                },
            });
            this.isConnected = true;
            return;
        } catch (innerError) {
             console.warn("Real Lyria connection failed, using Simulation.", innerError);
        }
      }

      this.isSimulation = true;
      this.isConnected = true;
      this.session = {
          setWeightedPrompts: async (args) => console.log("[Sim] Prompts:", args.weightedPrompts),
          setMusicGenerationConfig: async (args) => {
              this.currentConfig = args.musicGenerationConfig;
              console.log("[Sim] Config Full Update:", this.currentConfig);
          },
          reset_context: async () => {
              console.log("[Sim] Reset Context - Restarting Loop");
              this.stopSimulationLoop();
              if (this.audioContext?.state !== 'suspended') this.startSimulationLoop();
          },
          play: async () => this.startSimulationLoop(),
          pause: async () => this.stopSimulationLoop(),
          close: async () => {
              this.stopSimulationLoop();
              this.isConnected = false;
          }
      };
    } catch (e) {
      console.error("Connection error:", e);
      throw e;
    }
  }

  private scheduleAudioChunk(base64Data: string) {
    if (!this.audioContext || !this.gainNode) return;
    const rawBuffer = this.base64ToArrayBuffer(base64Data);
    const int16Data = new Int16Array(rawBuffer);
    const float32Data = new Float32Array(int16Data.length);
    for (let i = 0; i < int16Data.length; i++) float32Data[i] = int16Data[i] / 32768.0;

    const channels = 2;
    const frameCount = int16Data.length / channels;
    const audioBuffer = this.audioContext.createBuffer(channels, frameCount, SAMPLE_RATE);
    
    // We only visually process the first channel (mono mixdown for vis)
    const channel0 = float32Data.filter((_, i) => i % 2 === 0);
    audioBuffer.getChannelData(0).set(channel0);
    audioBuffer.getChannelData(1).set(float32Data.filter((_, i) => i % 2 !== 0));

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.gainNode);
    
    // Track ID
    const chunkId = Math.random().toString(36).substring(7);

    source.onended = () => {
       // Cleanup from tracking array
       this.scheduledAudio = this.scheduledAudio.filter(s => s.source !== source);
    };

    // Ensure seamless playback
    this.nextStartTime = Math.max(this.nextStartTime, this.audioContext.currentTime);
    const chunkStartTime = this.nextStartTime;
    source.start(this.nextStartTime);
    
    this.scheduledAudio.push({
        source,
        startTime: chunkStartTime,
        duration: audioBuffer.duration,
        id: chunkId
    });

    // store a copy reference for exports
    try {
      this.recordedBuffers.push({ buffer: audioBuffer, startTime: chunkStartTime, duration: audioBuffer.duration, id: chunkId });
      // ensure we have an active session (playback session). If none, create a transient session
      const now = this.audioContext.currentTime;
      if (!this.currentSession) {
        this.currentSession = { id: `s_${Date.now().toString(36)}`, startTime: chunkStartTime, endTime: null, buffers: [] };
      }
      this.currentSession.buffers.push({ buffer: audioBuffer, startTime: chunkStartTime, duration: audioBuffer.duration, id: chunkId });
    } catch (e) { console.warn('Failed to record buffer for export', e); }

    this.nextStartTime += audioBuffer.duration;

    // --- VISUALIZER PROCESSING ---
    const envelope = this.extractEnvelope(channel0, 256); 
    
    this.emit({
        type: 'chunk',
        chunk: {
            id: chunkId,
            data: envelope,
            startTime: chunkStartTime,
            duration: audioBuffer.duration,
            receivedAt: Date.now()
        }
    });
  }

  private extractEnvelope(data: Float32Array, step: number): Float32Array {
      const len = data.length;
      const result = new Float32Array(Math.ceil(len / step) * 2);
      let idx = 0;
      for (let i = 0; i < len; i += step) {
          let min = 1.0;
          let max = -1.0;
          const end = Math.min(len, i + step);
          for (let j = i; j < end; j++) {
              const v = data[j];
              if (v < min) min = v;
              if (v > max) max = v;
          }
          if (max < min) { min = 0; max = 0; }
          result[idx++] = min;
          result[idx++] = max;
      }
      return result;
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  private startSimulationLoop() {
      if (this.simulationInterval) return;
      
      const run = () => {
          const bpm = this.currentConfig.bpm || 100;
          const barDurationMs = (60 / bpm) * 4 * 1000;
          this.generateDrone(barDurationMs / 1000);
          this.simulationInterval = window.setTimeout(run, barDurationMs);
      };
      run();
  }

  private stopSimulationLoop() {
      if (this.simulationInterval) {
          clearTimeout(this.simulationInterval);
          this.simulationInterval = null;
      }
      this.scheduledAudio.forEach(s => { try { s.source.stop(); } catch(e) {} });
      this.scheduledAudio = [];
      this.activeNodes.forEach(n => {
          try { (n as any).stop?.(); } catch(e){}
          try { n.disconnect(); } catch(e) {}
      });
      this.activeNodes = [];
  }

  // Immediately stops all audio and resets the scheduling cursor
  public async stopAndClear() {
      if (this.isSimulation) {
          this.stopSimulationLoop();
      }
      
      this.scheduledAudio.forEach(item => {
          try { item.source.stop(); } catch(e) {}
      });
      this.scheduledAudio = [];
      
      if (this.audioContext) {
          this.nextStartTime = this.audioContext.currentTime + 0.1; 
      }

      // End current playback session if any (reset implies closing session)
      try { this.endSession(); } catch(e) {}

      this.emit({ type: 'reset' });
  }

  // Start a new playback session. Called when playback begins.
  public startSession() {
    if (!this.audioContext) this.initAudioContext();
    if (this.currentSession) return; // already started
    const now = this.audioContext ? this.audioContext.currentTime : Date.now() / 1000;
    this.currentSession = { id: `s_${Date.now().toString(36)}`, startTime: now, endTime: null, buffers: [] };
  }

  // End the current playback session and save it to sessions list
  public endSession() {
    if (!this.currentSession) return;
    // set end time as the end of last buffer if available
    const last = this.currentSession.buffers.length > 0 ? this.currentSession.buffers[this.currentSession.buffers.length - 1] : null;
    const endTime = last ? last.startTime + last.duration : (this.audioContext ? this.audioContext.currentTime : Date.now() / 1000);
    this.currentSession.endTime = endTime;
    // only keep sessions that have at least one buffer
    if (this.currentSession.buffers.length > 0) {
      this.sessions.push(this.currentSession);
    }
    this.currentSession = null;
  }

  // Trims the future queue to ensure quick response to parameter changes
  // Keeps 'retention' seconds of audio, drops the rest.
  public trimQueue(retention: number = 1.5) {
      if (!this.audioContext) return;
      const now = this.audioContext.currentTime;
      const cutOff = now + retention;
      let cutOccurred = false;

      this.scheduledAudio = this.scheduledAudio.filter(item => {
          // If start time is beyond cutoff, stop it
          if (item.startTime > cutOff) {
              try { item.source.stop(); } catch(e) {}
              cutOccurred = true;
              return false; 
          }
          return true;
      });

      // Adjust nextStartTime so new chunks play immediately after the kept ones
      if (this.scheduledAudio.length > 0) {
          const last = this.scheduledAudio[this.scheduledAudio.length - 1];
          this.nextStartTime = last.startTime + last.duration;
      } else {
          // If we trimmed everything (or nothing was playing), start fresh
          this.nextStartTime = now + 0.1;
      }
      
      if (cutOccurred) {
          console.log("Queue trimmed to:", cutOff);
          this.emit({ type: 'trim', time: cutOff });
      }
  }

  private generateDrone(duration: number) {
      if (!this.audioContext || !this.gainNode) return;
      const now = this.audioContext.currentTime;

      // Calculate Pitch based on Scale (Simulation Only)
      let baseFreq = 65.41; 
      const scaleStr = this.currentConfig.scale || 'C_MAJOR_A_MINOR';
      
      const roots: {[key:string]: number} = {
          'C': 0, 'C_SHARP': 1, 'D_FLAT': 1, 'D': 2, 'E_FLAT': 3, 'E': 4, 
          'F': 5, 'F_SHARP': 6, 'G_FLAT': 6, 'G': 7, 'A_FLAT': 8, 'A': 9, 
          'B_FLAT': 10, 'B': 11
      };
      
      let rootName = 'C';
      let longestMatch = '';
      for(const k of Object.keys(roots)) {
          if(scaleStr.startsWith(k)) {
            if (k.length > longestMatch.length) longestMatch = k;
          }
      }
      if (longestMatch) rootName = longestMatch;
      
      const semitones = roots[rootName] || 0;
      baseFreq = baseFreq * Math.pow(2, semitones / 12);

      // Simulation of a chunk for visualization
      const points = Math.ceil(duration * 172);
      const fakeEnvelope = new Float32Array(points * 2);
      for(let i=0; i<points; i++) {
          const amp = Math.random() * 0.5;
          fakeEnvelope[i*2] = -amp;
          fakeEnvelope[i*2+1] = amp;
      }
      
      const kick = this.audioContext.createOscillator();
      const kickGain = this.audioContext.createGain();
      kick.frequency.setValueAtTime(150, now);
      kick.frequency.exponentialRampToValueAtTime(0.01, now + 0.1);
      kickGain.gain.setValueAtTime(0.3, now);
      kickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      kick.connect(kickGain);
      kickGain.connect(this.gainNode);
      kick.start(now);
      kick.stop(now + 0.15);

      const layers = Math.max(1, Math.floor((this.currentConfig.density || 0.5) * 5));
      for (let i = 0; i < layers; i++) {
          const osc = this.audioContext.createOscillator();
          const g = this.audioContext.createGain();
          const f = this.audioContext.createBiquadFilter();
          const harmonic = (i % 3 === 0) ? 1 : (i % 3 === 1) ? 1.5 : 2; 
          osc.frequency.value = baseFreq * harmonic * (i + 1);
          osc.detune.value = (Math.random() - 0.5) * (this.currentConfig.temperature || 1) * 100;
          f.frequency.value = 200 + (this.currentConfig.brightness || 0.5) * 2000;
          g.gain.setValueAtTime(0, now);
          g.gain.linearRampToValueAtTime(0.05 / layers, now + duration * 0.2);
          g.gain.exponentialRampToValueAtTime(0.001, now + duration);
          osc.connect(f);
          f.connect(g);
          g.connect(this.gainNode);
          osc.start(now);
          osc.stop(now + duration + 0.1);
          this.activeNodes.push(osc, g, f);
      }
      
      // Sim uses audioContext time directly for start, but in real chunks we schedule ahead
      // We simulate scheduling ahead here
      const simStart = this.nextStartTime > now ? this.nextStartTime : now;
      this.nextStartTime = simStart + duration;

      this.emit({
          type: 'chunk',
          chunk: {
              id: Math.random().toString(36),
              data: fakeEnvelope,
              startTime: simStart,
              duration: duration,
              receivedAt: Date.now()
          }
      });
  }

  public async play() {
    if (!this.session) return;
    if (this.audioContext?.state === 'suspended') await this.audioContext.resume();
    // starting playback marks a new session
    this.startSession();
    await this.session.play();
  }

  public async pause() {
    if (!this.session) return;
    await this.session.pause();
    // pausing closes current playback session
    try { this.endSession(); } catch(e) {}
    this.stopSimulationLoop();
  }

  public async setPrompts(prompts: WeightedPrompt[]) {
    if (!this.session) return;
    const active = prompts.filter(p => p.isActive).map(p => ({ text: p.text, weight: p.weight }));
    if (active.length > 0) await this.session.setWeightedPrompts({ weightedPrompts: active });
  }

  public async updateConfig(config: MusicGenerationConfig) {
    if (!this.session) return;
    await this.session.setMusicGenerationConfig({ musicGenerationConfig: config });
  }

  public async resetContext() {
    if (!this.session) return;
    if (this.session.reset_context) {
      await this.session.reset_context();
    } else if (this.session.resetContext) {
      await this.session.resetContext();
    }
  }

  // Export helpers -------------------------------------------------------
  private encodeWavFromBuffer(buffer: AudioBuffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const length = buffer.length * numChannels * 2 + 44;
    const arrayBuffer = new ArrayBuffer(length);
    const view = new DataView(arrayBuffer);

    /* RIFF identifier */ writeString(view, 0, 'RIFF');
    /* file length */ view.setUint32(4, 36 + buffer.length * numChannels * 2, true);
    /* RIFF type */ writeString(view, 8, 'WAVE');
    /* format chunk identifier */ writeString(view, 12, 'fmt ');
    /* format chunk length */ view.setUint32(16, 16, true);
    /* sample format (raw) */ view.setUint16(20, 1, true);
    /* channel count */ view.setUint16(22, numChannels, true);
    /* sample rate */ view.setUint32(24, sampleRate, true);
    /* byte rate (sample rate * block align) */ view.setUint32(28, sampleRate * numChannels * 2, true);
    /* block align (channel count * bytes per sample) */ view.setUint16(32, numChannels * 2, true);
    /* bits per sample */ view.setUint16(34, 16, true);
    /* data chunk identifier */ writeString(view, 36, 'data');
    /* data chunk length */ view.setUint32(40, buffer.length * numChannels * 2, true);

    // write interleaved PCM16
    let offset = 44;
    const channels = [];
    for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c));
    for (let i = 0; i < buffer.length; i++) {
      for (let c = 0; c < numChannels; c++) {
        let sample = Math.max(-1, Math.min(1, channels[c][i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
      }
    }

    function writeString(dataview: DataView, offset: number, str: string) {
      for (let i = 0; i < str.length; i++) dataview.setUint8(offset + i, str.charCodeAt(i));
    }

    return new Blob([view], { type: 'audio/wav' });
  }

  public async exportChunksAsWav() {
    if (!this.recordedBuffers || this.recordedBuffers.length === 0) return [];
    const results: Array<{ id: string; blob: Blob; filename: string }> = [];
    for (const item of this.recordedBuffers) {
      const blob = this.encodeWavFromBuffer(item.buffer);
      results.push({ id: item.id, blob, filename: `chunk-${item.id}.wav` });
    }
    return results;
  }

  // Return session metadata (id, startTime, endTime, duration)
  public getSessions() {
    // include currentSession as in-progress session if present
    const out = this.sessions.map(s => ({ id: s.id, startTime: s.startTime, endTime: s.endTime, duration: s.endTime ? s.endTime - s.startTime : null }));
    if (this.currentSession) out.push({ id: this.currentSession.id, startTime: this.currentSession.startTime, endTime: this.currentSession.endTime, duration: this.currentSession.endTime ? this.currentSession.endTime - this.currentSession.startTime : null });
    return out;
  }

  // Mix a session's buffers into a single AudioBuffer (async)
  public async getMixedSessionBuffer(sessionId: string): Promise<AudioBuffer | null> {
    const session = this.sessions.find(s => s.id === sessionId) || (this.currentSession && this.currentSession.id === sessionId ? this.currentSession : null);
    if (!session || session.buffers.length === 0 || !this.audioContext) return null;
    const sampleRate = this.audioContext.sampleRate || SAMPLE_RATE;
    // compute relative times to session.startTime
    let lastEnd = 0;
    for (const b of session.buffers) {
      const relStart = b.startTime - session.startTime;
      lastEnd = Math.max(lastEnd, relStart + b.duration);
    }
    const totalSamples = Math.ceil(lastEnd * sampleRate);
    const offline = new OfflineAudioContext(2, totalSamples, sampleRate);
    for (const b of session.buffers) {
      const src = offline.createBufferSource();
      src.buffer = b.buffer;
      src.connect(offline.destination);
      const relStart = Math.max(0, b.startTime - session.startTime);
      src.start(relStart);
    }
    const rendered = await offline.startRendering();
    return rendered;
  }

  // Export each session as a separate WAV (mixed)
  public async exportSessionsAsWav() {
    const results: Array<{ id: string; blob: Blob; filename: string }> = [];
    for (const s of this.sessions) {
      const mixed = await this.getMixedSessionBuffer(s.id);
      if (!mixed) continue;
      const blob = this.encodeWavFromBuffer(mixed);
      results.push({ id: s.id, blob, filename: `session-${s.id}.wav` });
    }
    // include currentSession as well if present
    if (this.currentSession) {
      const mixed = await this.getMixedSessionBuffer(this.currentSession.id);
      if (mixed) results.push({ id: this.currentSession.id, blob: this.encodeWavFromBuffer(mixed), filename: `session-${this.currentSession.id}.wav` });
    }
    return results;
  }

  public async exportMixedWav() {
    if (!this.audioContext) return null;
    if (!this.recordedBuffers || this.recordedBuffers.length === 0) return null;

    // compute total length in samples
    let lastEnd = 0;
    for (const b of this.recordedBuffers) {
      lastEnd = Math.max(lastEnd, b.startTime + b.duration);
    }
    const sampleRate = this.audioContext.sampleRate || SAMPLE_RATE;
    const totalSamples = Math.ceil(lastEnd * sampleRate);

    const offline = new OfflineAudioContext(2, totalSamples, sampleRate);

    for (const b of this.recordedBuffers) {
      const src = offline.createBufferSource();
      src.buffer = b.buffer;
      src.connect(offline.destination);
      src.start(b.startTime);
    }

    const rendered = await offline.startRendering();
    const blob = this.encodeWavFromBuffer(rendered);
    return { blob, filename: `session-${Date.now()}.wav` };
  }

  // Return a shallow copy of recorded buffer metadata for UI
  public getRecordedBuffers() {
    return this.recordedBuffers.map(b => ({ id: b.id, startTime: b.startTime, duration: b.duration, buffer: b.buffer }));
  }

  // Play a preview of a buffer (with optional trim and gain)
  public async playBufferPreview(buffer: AudioBuffer, trimStart = 0, trimEnd?: number, gain = 1) {
    this.initAudioContext();
    if (!this.audioContext || !this.gainNode) return;
    const src = this.audioContext.createBufferSource();
    const g = this.audioContext.createGain();
    src.buffer = buffer;
    g.gain.value = gain;
    src.connect(g);
    g.connect(this.gainNode);
    const duration = (trimEnd ? Math.min(trimEnd, buffer.duration) : buffer.duration) - trimStart;
    try {
      src.start(0, Math.max(0, trimStart), Math.max(0, duration));
      // stop after duration
      setTimeout(() => {
        try { src.stop(); } catch (e) {}
        try { g.disconnect(); } catch (e) {}
      }, duration * 1000 + 200);
    } catch (e) { console.warn('Preview failed', e); }
  }

  // Export a custom mix based on provided edits. Each edit: { buffer, trimStart, trimEnd, gain, offset }
  public async exportCustomMix(edits: Array<{ buffer: AudioBuffer; trimStart: number; trimEnd?: number; gain?: number; offset?: number }>) {
    if (!this.audioContext || edits.length === 0) return null;
    const sampleRate = this.audioContext.sampleRate || SAMPLE_RATE;
    // compute total duration
    let last = 0;
    for (const e of edits) {
      const end = (e.offset || 0) + ((e.trimEnd ? e.trimEnd : e.buffer.duration) - (e.trimStart || 0));
      last = Math.max(last, end);
    }
    const totalSamples = Math.ceil(last * sampleRate);
    const offline = new OfflineAudioContext(2, totalSamples, sampleRate);
    for (const e of edits) {
      const src = offline.createBufferSource();
      // if trim differs from full buffer, create a sliced buffer
      if ((e.trimStart || 0) === 0 && (!e.trimEnd || e.trimEnd >= e.buffer.duration)) {
        src.buffer = e.buffer;
      } else {
        const start = Math.max(0, e.trimStart || 0);
        const end = Math.min(e.buffer.duration, e.trimEnd || e.buffer.duration);
        const len = Math.max(0, Math.floor((end - start) * sampleRate));
        const sliced = offline.createBuffer(e.buffer.numberOfChannels, len, sampleRate);
        for (let c = 0; c < e.buffer.numberOfChannels; c++) {
          const srcCh = e.buffer.getChannelData(c).subarray(Math.floor(start * e.buffer.sampleRate), Math.floor(end * e.buffer.sampleRate));
          sliced.getChannelData(c).set(srcCh);
        }
        src.buffer = sliced;
      }
      const gainNode = offline.createGain();
      gainNode.gain.value = (e.gain !== undefined) ? e.gain : 1;
      src.connect(gainNode);
      gainNode.connect(offline.destination);
      src.start((e.offset || 0));
    }
    const rendered = await offline.startRendering();
    const blob = this.encodeWavFromBuffer(rendered);
    return { blob, filename: `export-${Date.now()}.wav` };
  }
}

export const musicService = new MusicService();


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

      this.emit({ type: 'reset' });
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
    await this.session.play();
  }

  public async pause() {
    if (!this.session) return;
    await this.session.pause();
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
}

export const musicService = new MusicService();

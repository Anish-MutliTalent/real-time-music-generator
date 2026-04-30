
import React, { useState, useEffect, useCallback, useRef } from 'react';
import PromptLayer from './components/PromptLayer';
import ControlDeck from './components/ControlDeck';
import Visualizer from './components/Visualizer';
import BpmPopup from './components/BpmPopup';
import KeyPopup from './components/KeyPopup';
import { generateRandomInitialPrompts, getRandomSuggestions } from './constants';
import { WeightedPrompt, MacroState, InstrumentState, MacroValue, MusicGenerationConfig } from './types';
import { musicService } from './services/musicService';

export default function App() {
  // Use generators for initial states to provide vast variety on every load
  const [isPlaying, setIsPlaying] = useState(false);
  const [prompts, setPrompts] = useState<WeightedPrompt[]>(() => generateRandomInitialPrompts(3));
  const [suggestions, setSuggestions] = useState<string[]>(() => getRandomSuggestions(10));
  const [textInput, setTextInput] = useState('');
  const [showBpmPopup, setShowBpmPopup] = useState(false);
  const [showKeyPopup, setShowKeyPopup] = useState(false);
  
  const [macroState, setMacroState] = useState<MacroState>({
    density: 'auto',
    brightness: 'auto',
    chaos: 'auto',
    bpm: 'auto',
    key: 'auto'
  });

  const [instrumentState, setInstrumentState] = useState<InstrumentState>({
    drums: true,
    bass: true,
    other: true
  });

  const macroStateRef = useRef(macroState);
  useEffect(() => { macroStateRef.current = macroState; }, [macroState]);

  const updateApiPrompts = useCallback(async (currentPrompts: WeightedPrompt[]) => {
    if (isPlaying) {
         // Trim queue for fast response, then send prompts
         musicService.trimQueue(); 
         await musicService.setPrompts(currentPrompts);
    }
  }, [isPlaying]);

  const formatKeyForApi = (keyStr: string): string | undefined => {
    if (keyStr === 'auto') return undefined;
    const parts = keyStr.split(' ');
    if (parts.length !== 2) return undefined;
    const root = parts[0];
    const mode = parts[1];
    const rootIndices: {[key: string]: number} = {
        'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4,
        'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9,
        'A#': 10, 'Bb': 10, 'B': 11
    };
    let index = rootIndices[root];
    if (index === undefined) return undefined;
    if (mode === 'Minor') index = (index + 3) % 12;
    const apiEnums = [
        'C_MAJOR_A_MINOR', 'D_FLAT_MAJOR_B_FLAT_MINOR', 'D_MAJOR_B_MINOR',
        'E_FLAT_MAJOR_C_MINOR', 'E_MAJOR_D_FLAT_MINOR', 'F_MAJOR_D_MINOR',
        'G_FLAT_MAJOR_E_FLAT_MINOR', 'G_MAJOR_E_MINOR', 'A_FLAT_MAJOR_F_MINOR',
        'A_MAJOR_G_FLAT_MINOR', 'B_FLAT_MAJOR_G_MINOR', 'B_MAJOR_A_FLAT_MINOR'
    ];
    return apiEnums[index];
  };

  const generateConfig = (ms: MacroState, is: InstrumentState): MusicGenerationConfig => {
      const config: MusicGenerationConfig = {
        density: ms.density === 'auto' ? 0.5 : (ms.density as number),
        brightness: ms.brightness === 'auto' ? 0.5 : (ms.brightness as number),
        bpm: ms.bpm === 'auto' ? 100 : (ms.bpm as number),
        temperature: ms.chaos === 'auto' ? 1.1 : (ms.chaos as number * 3.0),
        mute_drums: !is.drums,
        mute_bass: !is.bass,
        only_bass_and_drums: !is.other,
      };
      const apiScale = formatKeyForApi(ms.key as string);
      if (apiScale) config.scale = apiScale;
      return config;
  };

  const prevMacroStateRef = useRef<MacroState>(macroState);

  useEffect(() => {
    if (!isPlaying) {
        prevMacroStateRef.current = macroState;
        return;
    }

    const timer = setTimeout(async () => {
        const config = generateConfig(macroState, instrumentState);
        const prev = prevMacroStateRef.current;
        const bpmChanged = prev.bpm !== macroState.bpm;
        const keyChanged = prev.key !== macroState.key;
        const chaosChanged = prev.chaos !== macroState.chaos;

        if (bpmChanged || keyChanged) {
            await musicService.stopAndClear();
            await musicService.updateConfig(config);
            await musicService.resetContext();
            await musicService.play();
        } else if (chaosChanged) {
            await musicService.updateConfig(config);
            await musicService.resetContext(); 
        } else {
             musicService.trimQueue(); 
             await musicService.updateConfig(config);
        }
        prevMacroStateRef.current = macroState;
    }, 150);
    return () => clearTimeout(timer);
  }, [macroState, instrumentState, isPlaying]);

  const togglePlay = async () => {
    try {
      if (!isPlaying) {
        await musicService.connect();
        await musicService.setPrompts(prompts);
        const config = generateConfig(macroState, instrumentState);
        await musicService.updateConfig(config);
        await musicService.play();
      } else {
        await musicService.pause();
      }
      setIsPlaying(!isPlaying);
    } catch (e) {
      console.error("Play error:", e);
    }
  };

  const handleMacroChange = (key: keyof MacroState, val: MacroValue | string) => {
      setMacroState(prev => ({ ...prev, [key]: val }));
  };

  return (
    <div className="h-screen w-full flex flex-col bg-black overflow-hidden font-sans">
      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-40">
        <div className="w-full mx-auto">
          <div className="w-full flex justify-between items-center mb-12">
             <h1 className="text-2xl font-semibold tracking-tight">Generate some music</h1>
          </div>

          <div className="flex flex-col items-center">
             <PromptLayer 
               prompts={prompts} 
               onUpdate={(id, w) => {
                 const up = prompts.map(p => p.id === id ? {...p, weight: w} : p);
                 setPrompts(up); updateApiPrompts(up);
               }} 
               onToggle={(id) => {
                 const up = prompts.map(p => p.id === id ? {...p, isActive: !p.isActive} : p);
                 setPrompts(up); updateApiPrompts(up);
               }} 
               onDelete={(id) => {
                 const up = prompts.filter(p => p.id !== id);
                 setPrompts(up); updateApiPrompts(up);
               }}
               onEdit={(id, t) => {
                 const up = prompts.map(p => p.id === id ? {...p, text: t} : p);
                 setPrompts(up); updateApiPrompts(up);
               }}
             />

             <div className="w-full max-w-3xl mb-8 relative">
                <input 
                  type="text" 
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && textInput) {
                      const np = { id: Date.now().toString(), text: textInput, weight: 0.5, color: '#cba6f7', isActive: true };
                      const up = [np, ...prompts];
                      setPrompts(up); setTextInput(''); updateApiPrompts(up);
                    }
                  }}
                  placeholder="Add a prompt ..."
                  className="w-full bg-[#111] rounded-2xl py-4 pl-10 pr-12 text-neutral-300 border border-white/5"
                />
             </div>

             <div className="w-full max-w-3xl flex flex-wrap gap-2 justify-center mb-12">
                {suggestions.map(s => (
                   <button key={s} onClick={() => {
                     const np = { id: Date.now().toString(), text: s, weight: 0.5, color: '#f9e2af', isActive: true };
                     const up = [np, ...prompts];
                     setPrompts(up); updateApiPrompts(up);
                   }} className="px-4 py-2 rounded-xl bg-neutral-900 text-neutral-400 text-sm border border-neutral-800 hover:bg-neutral-800 transition-colors">
                      {s}
                   </button>
                ))}
                <button 
                  onClick={() => setSuggestions(getRandomSuggestions(10))}
                  className="px-4 py-2 rounded-xl bg-neutral-800 text-white text-sm border border-white/10 hover:bg-neutral-700 transition-colors flex items-center gap-2"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  Shuffle
                </button>
             </div>

             <ControlDeck 
                macroState={macroState}
                instrumentState={instrumentState}
                onMacroChange={handleMacroChange}
                onInstrumentToggle={(k) => setInstrumentState(p => ({ ...p, [k]: !p[k] }))}
             />
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-5xl px-6 z-50">
        <div className="bg-[#111]/90 backdrop-blur-xl rounded-[2.5rem] p-3 flex items-center gap-4 border border-white/10 shadow-2xl">
           <button onClick={togglePlay} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isPlaying ? 'bg-[#ff9cd6] text-black' : 'bg-[#333] text-white'}`}>
             {isPlaying ? <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg> : <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
           </button>

           <div className="flex-1 h-10 bg-[#0a0a0a] rounded-xl overflow-hidden relative border border-white/5">
              <Visualizer isPlaying={isPlaying} />
              <div className="absolute top-0 left-1/2 w-px h-full bg-white/20 transform -translate-x-1/2" />
           </div>

           <div className="flex items-center gap-2">
              <div className="relative">
                {showBpmPopup && (
                    <BpmPopup 
                        currentBpm={macroState.bpm} 
                        onApply={(v) => { handleMacroChange('bpm', v); setShowBpmPopup(false); }} 
                        onClose={() => setShowBpmPopup(false)}
                    />
                )}
                <button 
                  onClick={() => { setShowKeyPopup(false); setShowBpmPopup(!showBpmPopup); }} 
                  className={`min-w-[64px] px-3 py-2 rounded-lg bg-[#222] border ${showBpmPopup ? 'border-[#ffccff]' : 'border-transparent'} flex flex-col items-center transition-colors`}
                >
                   <span className="text-[10px] font-bold text-neutral-500 uppercase">BPM</span>
                   <span className="text-xs font-bold text-white">{macroState.bpm === 'auto' ? 'Auto' : macroState.bpm}</span>
                </button>
              </div>
              
              <div className="relative">
                {showKeyPopup && (
                    <KeyPopup
                        currentKey={macroState.key}
                        onApply={(v) => { handleMacroChange('key', v); setShowKeyPopup(false); }}
                        onClose={() => setShowKeyPopup(false)}
                    />
                )}
                <button 
                  onClick={() => { setShowBpmPopup(false); setShowKeyPopup(!showKeyPopup); }}
                  className={`min-w-[48px] px-3 py-2 rounded-lg bg-[#222] border ${showKeyPopup ? 'border-[#ffccff]' : 'border-transparent'} flex flex-col items-center transition-colors`}
                >
                   <span className="text-[10px] font-bold text-neutral-500 uppercase">KEY</span>
                   <span className="text-xs font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis max-w-[50px]">
                      {macroState.key === 'auto' ? 'Auto' : (macroState.key as string).replace(' ', '')}
                   </span>
                </button>
              </div>
           </div>
           
           <button className="w-10 h-10 rounded-full flex items-center justify-center text-neutral-500 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.482 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
           </button>
        </div>
      </div>
    </div>
  );
}

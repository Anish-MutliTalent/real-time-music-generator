import React from 'react';
import { MacroValue, MacroState, InstrumentState } from '../types';

interface ControlDeckProps {
  macroState: MacroState;
  instrumentState: InstrumentState;
  onMacroChange: (key: keyof MacroState, val: MacroValue) => void;
  onInstrumentToggle: (key: keyof InstrumentState) => void;
  vertical?: boolean;
}

const MacroControl: React.FC<{
  label: string;
  value: MacroValue;
  onChange: (val: MacroValue) => void;
}> = ({ label, value, onChange }) => {
  const isAuto = value === 'auto';
  const numericValue = typeof value === 'number' ? value : 0.5;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex bg-[#161616] rounded-full p-1.5 border border-white/10 items-center w-48 h-14 relative shadow-inner">
         
         <button
            onClick={() => onChange('auto')}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 shrink-0 relative z-30 ${
                isAuto 
                  ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.4)] scale-100' 
                  : 'bg-[#222] text-neutral-600 hover:text-neutral-300 hover:bg-[#2a2a2a] scale-95'
            }`}
         >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
               <path fillRule="evenodd" d="M9 4.5a.75.75 0 0 1 .721.544l.813 2.846a3.75 3.75 0 0 0 2.576 2.576l2.846.813a.75.75 0 0 1 0 1.442l-2.846.813a3.75 3.75 0 0 0-2.576 2.576l-.813 2.846a.75.75 0 0 1-1.442 0l-.813-2.846a3.75 3.75 0 0 0-2.576-2.576l-2.846-.813a.75.75 0 0 1 0-1.442l2.846-.813a3.75 3.75 0 0 0 2.576-2.576l.813-2.846A.75.75 0 0 1 9 4.5ZM18 1.5a.75.75 0 0 1 .728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 0 1 0 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 0 1-1.456 0l-.258-1.036a2.625 2.625 0 0 0-1.91-1.91l-1.036-.258a.75.75 0 0 1 0-1.456l1.036-.258a2.625 2.625 0 0 0 1.91-1.91l.258-1.036A.75.75 0 0 1 18 1.5ZM16.5 15a.75.75 0 0 1 .712.513l.394 1.183c.15.447.5.799.948.948l1.183.395a.75.75 0 0 1 0 1.422l-1.183.395c-.447.15-.799.5-.948.948l-.395 1.183a.75.75 0 0 1-1.422 0l-.395-1.183a1.5 1.5 0 0 0-.948-.948l-1.183-.395a.75.75 0 0 1 0-1.422l1.183-.395c.447-.15.799-.5.948-.948l.395-1.183A.75.75 0 0 1 16.5 15Z" clipRule="evenodd" />
            </svg>
         </button>

         <div className="flex-1 relative h-full flex items-center mx-3 isolate">
            <input
               type="range"
               min="0"
               max="1"
               step="0.01"
               value={numericValue}
               onChange={(e) => onChange(parseFloat(e.target.value))}
               className="absolute inset-0 w-full h-full opacity-0 z-40 cursor-pointer"
            />

            <div className="w-full h-1 bg-[#333] rounded-full overflow-hidden relative z-10 pointer-events-none">
               <div 
                  className={`h-full transition-opacity duration-300 ${isAuto ? 'opacity-0' : 'bg-white opacity-100'}`} 
                  style={{ width: `${numericValue * 100}%` }}
               />
            </div>

            <div className="absolute inset-0 flex items-center justify-between opacity-10 pointer-events-none px-1 z-0">
               {[...Array(5)].map((_, i) => (
                  <div key={i} className="w-0.5 h-3 bg-white rounded-full"></div>
               ))}
            </div>
            
            <div 
               className="w-3.5 h-3.5 bg-white rounded-full shadow-[0_0_12px_rgba(255,255,255,0.6)] absolute pointer-events-none transition-all duration-150 z-20"
               style={{ 
                 left: `${numericValue * 100}%`,
                 transform: `translateX(-50%) scale(${isAuto ? 0.4 : 1.1})`,
                 opacity: isAuto ? 0.2 : 1
               }} 
            />
         </div>
      </div>
      <span className="text-[10px] text-neutral-500 font-bold tracking-widest uppercase">{label}</span>
    </div>
  );
};

const InstrumentControl: React.FC<{
  label: string;
  active: boolean;
  onToggle: () => void;
}> = ({ label, active, onToggle }) => {
  return (
    <div className="flex flex-col items-center gap-3">
        <button 
           onClick={onToggle}
           className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 border ${active ? 'bg-[#1f2937] text-[#4fd1c5] border-[#4fd1c5]/30' : 'bg-[#111] text-neutral-700 border-white/5 hover:border-white/20'}`}
        >
           {active ? (
             <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
              <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.58 12a8.724 8.724 0 00-3.045-6.65.6.6 0 11.782-.916A9.927 9.927 0 0119.78 12a9.922 9.922 0 01-3.464 7.566.6.6 0 11-.782-.916A8.724 8.724 0 0018.58 12z" />
             </svg>
           ) : (
             <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-5 h-5 opacity-50">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
             </svg>
           )}
        </button>
        <span className="text-[10px] text-neutral-500 font-bold tracking-widest uppercase">{label}</span>
    </div>
  )
};

const ControlDeck: React.FC<ControlDeckProps> = ({ 
    macroState, instrumentState, onMacroChange, onInstrumentToggle, vertical = false 
}) => {
  if (!vertical) {
    return (
      <div className="w-full max-w-5xl bg-[#0a0a0a] rounded-[2.5rem] p-5 px-8 flex items-center justify-between border border-white/5 shadow-2xl backdrop-blur-md">
        <MacroControl label="Density" value={macroState.density} onChange={(v) => onMacroChange('density', v)} />
        <div className="h-8 w-px bg-white/5 mx-2" />
        <MacroControl label="Brightness" value={macroState.brightness} onChange={(v) => onMacroChange('brightness', v)} />
        <div className="h-8 w-px bg-white/5 mx-2" />
        <MacroControl label="Chaos" value={macroState.chaos} onChange={(v) => onMacroChange('chaos', v)} />
        <div className="h-8 w-px bg-white/5 mx-4" />
        <div className="flex gap-4">
          <InstrumentControl label="Drums" active={instrumentState.drums} onToggle={() => onInstrumentToggle('drums')} />
          <InstrumentControl label="Bass" active={instrumentState.bass} onToggle={() => onInstrumentToggle('bass')} />
          <InstrumentControl label="Other" active={instrumentState.other} onToggle={() => onInstrumentToggle('other')} />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl bg-[#0a0a0a] rounded-[2.5rem] p-6 px-8 flex flex-col items-center justify-center border border-white/5 shadow-2xl backdrop-blur-md gap-4">
      <MacroControl label="Density" value={macroState.density} onChange={(v) => onMacroChange('density', v)} />
      <div className="w-full h-px bg-white/5" />
      <MacroControl label="Brightness" value={macroState.brightness} onChange={(v) => onMacroChange('brightness', v)} />
      <div className="w-full h-px bg-white/5" />
      <MacroControl label="Chaos" value={macroState.chaos} onChange={(v) => onMacroChange('chaos', v)} />
      <div className="w-full h-px bg-white/5" />
      <div className="flex items-center justify-center gap-4">
        <InstrumentControl label="Drums" active={instrumentState.drums} onToggle={() => onInstrumentToggle('drums')} />
        <InstrumentControl label="Bass" active={instrumentState.bass} onToggle={() => onInstrumentToggle('bass')} />
        <InstrumentControl label="Other" active={instrumentState.other} onToggle={() => onInstrumentToggle('other')} />
      </div>
    </div>
  );
};

export default ControlDeck;
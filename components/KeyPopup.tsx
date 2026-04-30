
import React, { useState, useEffect } from 'react';

interface KeyPopupProps {
  currentKey: string | 'auto';
  onApply: (val: string | 'auto') => void;
  onClose: () => void;
}

const KEY_PAIRS = [
  { label: 'C / Am', root: 'C' },
  { label: 'C# / Bbm', root: 'C#' },
  { label: 'D / Bm', root: 'D' },
  { label: 'Eb / Cm', root: 'Eb' },
  { label: 'E / C#m', root: 'E' },
  { label: 'F / Dm', root: 'F' },
  { label: 'F# / Ebm', root: 'F#' },
  { label: 'G / Em', root: 'G' },
  { label: 'Ab / Fm', root: 'Ab' },
  { label: 'A / F#m', root: 'A' },
  { label: 'Bb / Gm', root: 'Bb' },
  { label: 'B / G#m', root: 'B' },
];

const KeyPopup: React.FC<KeyPopupProps> = ({ currentKey, onApply, onClose }) => {
  const [selectedRoot, setSelectedRoot] = useState<string>('C');
  const [isAuto, setIsAuto] = useState(currentKey === 'auto');

  useEffect(() => {
    if (currentKey !== 'auto') {
      const root = currentKey.split(' ')[0];
      setSelectedRoot(root);
      setIsAuto(false);
    } else {
      setIsAuto(true);
    }
  }, [currentKey]);

  const handleApply = () => {
    if (isAuto) {
      onApply('auto');
    } else {
      // Default to "Major" internally; Lyria enums handle the relative minor logic via root + scale
      onApply(`${selectedRoot} Major`);
    }
  };

  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 z-[60] animate-in fade-in slide-in-from-bottom-2 duration-200 origin-bottom">
      <div className="bg-[#181818] w-[280px] p-5 rounded-[2rem] shadow-2xl border border-white/10 flex flex-col gap-4 relative">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">KEY / SCALE</span>
            <div className="flex items-center gap-2">
                 <span className={`text-xs font-bold ${isAuto ? 'text-white' : 'text-neutral-500'}`}>Auto</span>
                 <button 
                   onClick={() => setIsAuto(!isAuto)}
                   className={`w-10 h-6 rounded-full p-1 transition-colors ${isAuto ? 'bg-[#ff9cd6]' : 'bg-[#333]'}`}
                 >
                    <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-transform ${isAuto ? 'translate-x-4' : 'translate-x-0'}`} />
                 </button>
            </div>
        </div>

        {/* Key Selection Grid */}
        <div className={`grid grid-cols-3 gap-2 transition-opacity duration-200 ${isAuto ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
            {KEY_PAIRS.map(pair => (
                <button
                    key={pair.root}
                    onClick={() => setSelectedRoot(pair.root)}
                    className={`h-11 rounded-xl text-[11px] font-bold transition-all border ${
                        selectedRoot === pair.root 
                        ? 'bg-white text-black border-white shadow-lg scale-[1.02]' 
                        : 'bg-[#222] text-neutral-400 border-transparent hover:bg-[#2a2a2a] hover:text-white'
                    }`}
                >
                    {pair.label}
                </button>
            ))}
        </div>

        <p className="text-center text-[10px] text-neutral-500 font-medium px-2 leading-tight">
          Scale changes will cause the audio to restart
        </p>

        <div className="flex justify-end gap-6 pt-1">
          <button 
            onClick={onClose}
            className="text-neutral-400 text-sm font-bold hover:text-white transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={handleApply}
            className="text-[#ff9cd6] text-sm font-bold hover:brightness-110 active:scale-95 transition-all"
          >
            Apply
          </button>
        </div>

        {/* Triangle Pointer */}
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#181818] border-r border-b border-white/10 rotate-45" />
      </div>
      
      {/* Overlay to close when clicking outside */}
      <div 
        className="fixed inset-0 -z-10 w-[200vw] h-[200vh] -translate-x-1/2 -translate-y-1/2" 
        onClick={onClose}
      />
    </div>
  );
};

export default KeyPopup;

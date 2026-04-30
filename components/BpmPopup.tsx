
import React, { useState } from 'react';
import { MacroValue } from '../types';

interface BpmPopupProps {
  currentBpm: MacroValue;
  onApply: (val: MacroValue) => void;
  onClose: () => void;
}

const BpmPopup: React.FC<BpmPopupProps> = ({ currentBpm, onApply, onClose }) => {
  const [tempBpm, setTempBpm] = useState<MacroValue>(currentBpm);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTempBpm(parseInt(e.target.value, 10));
  };

  const handleReset = () => {
    setTempBpm('auto');
  };

  return (
    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 mb-2 z-[60] animate-in fade-in zoom-in duration-200 origin-bottom">
      <div className="bg-[#181818] w-72 p-6 rounded-[2rem] shadow-2xl border border-white/10 flex flex-col gap-6 relative">
        
        {/* BPM Display Area */}
        <div className="bg-[#222] rounded-2xl p-4 flex flex-col items-start gap-1">
          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">BPM</span>
          <span className="text-3xl font-bold text-white leading-tight">
            {tempBpm === 'auto' ? 'Auto' : tempBpm}
          </span>
        </div>

        {/* Custom Slider */}
        <div className="relative h-6 flex items-center">
          <input
            type="range"
            min="60"
            max="180"
            value={tempBpm === 'auto' ? 100 : tempBpm}
            onChange={handleSliderChange}
            className="w-full h-2 rounded-full appearance-none bg-[#70214c] cursor-pointer z-20 outline-none"
            style={{
                background: `linear-gradient(to right, #ffccff ${tempBpm === 'auto' ? 0 : ((tempBpm as number - 60) / 120) * 100}%, #70214c ${tempBpm === 'auto' ? 0 : ((tempBpm as number - 60) / 120) * 100}%)`
            }}
          />
          <style>{`
            input[type=range]::-webkit-slider-thumb {
              -webkit-appearance: none !important;
              height: 24px !important;
              width: 24px !important;
              border-radius: 50% !important;
              background: #181818 !important;
              border: 2px solid white !important;
              cursor: pointer !important;
              margin-top: -1px !important;
              box-shadow: 0 2px 5px rgba(0,0,0,0.5) !important;
              transform: scale(1);
              transition: transform 0.1s;
            }
            input[type=range]:active::-webkit-slider-thumb {
              transform: scale(1.1);
            }
          `}</style>
        </div>

        <p className="text-center text-[11px] text-neutral-500 font-medium px-2 leading-relaxed">
          Adjusting the BPM during playback will cause the audio to restart
        </p>

        <div className="flex justify-end gap-6 pt-2">
          <button 
            onClick={handleReset}
            className="text-[#f9b2d8] text-sm font-bold hover:brightness-110 active:scale-95 transition-all"
          >
            Reset
          </button>
          <button 
            onClick={() => onApply(tempBpm)}
            className="text-[#f9b2d8] text-sm font-bold hover:brightness-110 active:scale-95 transition-all"
          >
            Apply
          </button>
        </div>

        {/* Triangle Pointer */}
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#181818] border-r border-b border-white/10 rotate-45" />
      </div>
      
      {/* Overlay to close when clicking outside */}
      <div 
        className="fixed inset-0 -z-10" 
        onClick={onClose}
      />
    </div>
  );
};

export default BpmPopup;

import React, { useState } from 'react';
import { WeightedPrompt } from '../types';

interface PromptLayerProps {
  prompts: WeightedPrompt[];
  onUpdate: (id: string, newWeight: number) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, newText: string) => void;
}

const PromptLayer: React.FC<PromptLayerProps> = ({ prompts, onUpdate, onToggle, onDelete, onEdit }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const startEditing = (prompt: WeightedPrompt) => {
    setEditingId(prompt.id);
    setEditValue(prompt.text);
  };

  const saveEdit = (id: string) => {
    if (editValue.trim()) {
      onEdit(id, editValue.trim());
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') saveEdit(id);
    if (e.key === 'Escape') setEditingId(null);
  };

  return (
    <div className="w-full max-w-3xl flex flex-col gap-4 mb-8">
      {prompts.map((prompt) => (
        <div 
          key={prompt.id} 
          className={`relative group h-20 rounded-2xl flex items-center transition-all duration-300 overflow-hidden ${
            prompt.isActive ? 'bg-[#121212] ring-1 ring-white/5 shadow-xl' : 'bg-neutral-900/50 opacity-40 grayscale'
          }`}
        >
          {/* Background Fill representing Weight - Track-like experience */}
          <div 
            className="absolute left-0 top-0 bottom-0 transition-all duration-150 ease-out opacity-20 pointer-events-none"
            style={{ 
              width: `${prompt.weight * 100}%`,
              backgroundColor: prompt.color
            }}
          />
          
          {/* Interactive Range Input - Z-10 */}
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={prompt.weight}
            onChange={(e) => onUpdate(prompt.id, parseFloat(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            disabled={!prompt.isActive || editingId === prompt.id}
          />

          {/* Controls Layer - Z-20 - High visibility buttons */}
          <div className="relative z-20 flex items-center w-full h-full px-5 gap-4 pointer-events-none">
            
            {/* Left Actions: Edit & Delete - Visible without hover, but subtly dimmed */}
            <div className="flex items-center gap-2 pointer-events-auto">
               <button 
                 onClick={(e) => { e.stopPropagation(); startEditing(prompt); }}
                 className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-all active:scale-90 border border-white/5"
                 title="Edit"
               >
                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                   <path d="m2.695 14.762-1.262 3.155a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.886L17.5 5.501a2.121 2.121 0 0 0-3-3L3.58 13.419a4 4 0 0 0-.885 1.343Z" />
                 </svg>
               </button>
               <button 
                 onClick={(e) => { e.stopPropagation(); onDelete(prompt.id); }}
                 className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-red-500/10 text-neutral-400 hover:text-red-400 transition-all active:scale-90 border border-white/5"
                 title="Delete"
               >
                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                   <path fillRule="evenodd" d="M8.75 3A2.75 2.75 0 0 0 6 5.75v.67c-.158.014-.316.03-.474.048L4.047 6.67a.75.75 0 1 0 .176 1.49l.115-.013H15.66l.115.013a.75.75 0 0 0 .176-1.49l-1.479-.172A4.823 4.823 0 0 0 14 6.42v-.67A2.75 2.75 0 0 0 11.25 3h-2.5ZM7.5 5.75c0-.69.56-1.25 1.25-1.25h2.5c.69 0 1.25.56 1.25 1.25v.622c-.615-.02-1.235-.031-1.859-.031H8.11c-.624 0-1.244.01-1.859.031v-.622ZM4.857 9.442a.75.75 0 0 0-1.014.274l-.223.385a.75.75 0 0 0 .274 1.014l.223-.385a.75.75 0 0 0-.274-1.014l.223-.385ZM12.35 18.25A2.75 2.75 0 0 0 15 15.5v-5h-1.5v5c0 .69-.56 1.25-1.25 1.25h-4.5c-.69 0-1.25-.56-1.25-1.25v-5H5v5a2.75 2.75 0 0 0 2.75 2.75h4.6ZM9.25 11a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5a.75.75 0 0 1 .75-.75Zm2.25.75a.75.75 0 0 0-1.5 0v3.5a.75.75 0 0 0 1.5 0v-3.5Z" clipRule="evenodd" />
                 </svg>
               </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-w-0">
              {editingId === prompt.id ? (
                <div className="pointer-events-auto">
                  <input
                    autoFocus
                    className="bg-neutral-800 border border-white/20 rounded-xl px-4 py-2 text-xl font-bold text-white w-full focus:outline-none focus:ring-2 focus:ring-white/10"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => saveEdit(prompt.id)}
                    onKeyDown={(e) => handleKeyDown(e, prompt.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              ) : (
                <div className="flex flex-col">
                  <span 
                    className="text-2xl font-bold tracking-tight block truncate transition-colors duration-300"
                    style={{ color: prompt.isActive ? prompt.color : '#444' }}
                  >
                    {prompt.text}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                     <div className="h-1 w-12 bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-white/40 rounded-full" 
                          style={{ width: `${prompt.weight * 100}%` }} 
                        />
                     </div>
                     <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-tighter">Weight {Math.round(prompt.weight * 100)}%</span>
                  </div>
                </div>
              )}
            </div>

            {/* Status & Toggle */}
            <div className="flex items-center gap-4 pointer-events-auto">
               <button 
                 onClick={(e) => {
                   e.stopPropagation();
                   onToggle(prompt.id);
                 }}
                 className={`relative shrink-0 w-12 h-6 rounded-full transition-all duration-300 flex items-center p-1 ${
                   prompt.isActive ? 'shadow-[0_0_10px_rgba(255,255,255,0.1)]' : 'bg-neutral-800'
                 }`}
                 style={{ backgroundColor: prompt.isActive ? prompt.color : '#222' }}
               >
                 <div 
                   className={`w-4 h-4 bg-black/80 rounded-full shadow-md transform transition-transform duration-300 ${
                     prompt.isActive ? 'translate-x-6' : 'translate-x-0'
                   }`}
                 />
               </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PromptLayer;
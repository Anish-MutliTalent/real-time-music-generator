import React, { useState } from 'react';
import { MOODS, GENRES, INSTRUMENTS, MODIFIERS, COLORS } from '../constants';

type Props = {
  onAddPreset: (text: string, color?: string) => void;
};

export default function PresetPanel({ onAddPreset }: Props) {
  const [mood, setMood] = useState<string | null>(null);
  const [genre, setGenre] = useState<string | null>(null);
  const [instrument, setInstrument] = useState<string | null>(null);
  const [modifier, setModifier] = useState<string | null>(null);

  const add = () => {
    const parts: string[] = [];
    if (mood) parts.push(mood);
    if (genre) parts.push(genre);
    if (instrument) parts.push(`with ${instrument}`);
    if (modifier) parts.push(modifier);
    const text = parts.join(' ');
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    if (text.trim().length > 0) {
      onAddPreset(text, color);
      // keep selections to allow quick multiple adds
    }
  };
  // Choose a color for an item based on keywords, falling back to hashed COLORS
  const getColorFor = (text: string) => {
    const lower = text.toLowerCase();
    const redKeywords = ['aggressive', 'gritty', 'powerful', 'brutalist', 'distorted', 'hard'];
    const blueKeywords = ['melancholic', 'dreamy', 'nostalgic', 'euphoric', 'underwater', 'ethereal'];
    const purpleKeywords = ['neon', 'cosmic', 'cybernetic', 'spectral'];
    const yellowKeywords = ['bright', 'heroic', 'euphoric', 'cinematic', 'upbeat'];
    const greenKeywords = ['organic', 'acoustic', 'lo-fi', 'folk', 'rustic'];

    if (redKeywords.some(k => lower.includes(k))) return COLORS[10] || '#fb4934';
    if (blueKeywords.some(k => lower.includes(k))) return COLORS[1] || '#9dffc0';
    if (purpleKeywords.some(k => lower.includes(k))) return COLORS[3] || '#cba6f7';
    if (yellowKeywords.some(k => lower.includes(k))) return COLORS[2] || '#f6e05e';
    if (greenKeywords.some(k => lower.includes(k))) return COLORS[0] || '#4fd1c5';

    // fallback: stable pick based on hash
    let h = 0;
    for (let i = 0; i < text.length; i++) h = (h << 5) - h + text.charCodeAt(i);
    const idx = Math.abs(h) % COLORS.length;
    return COLORS[idx];
  };

  const textColorFor = (bgHex: string) => {
    // simple luminance check
    const hex = bgHex.replace('#','');
    const r = parseInt(hex.substring(0,2),16);
    const g = parseInt(hex.substring(2,4),16);
    const b = parseInt(hex.substring(4,6),16);
    const luminance = 0.2126*r + 0.7152*g + 0.0722*b;
    return luminance > 180 ? 'black' : 'white';
  };

  const optionBtn = (value: string | null, setFn: (v: string | null)=>void) => (v: string) => {
    const active = value === v;
    const bg = getColorFor(v);
    const textC = textColorFor(bg);
    return (
      <button
        key={v}
        onClick={() => setFn(active ? null : v)}
        className={`px-3 py-1 rounded-xl text-sm border transition-shadow duration-150`}
        style={{ background: active ? bg : 'transparent', borderColor: active ? `${bg}55` : 'rgba(255,255,255,0.06)', color: active ? textC : '#c9c9c9' }}
      >
        {v}
      </button>
    );
  };

  return (
    <div className="w-96 max-w-[28rem] bg-[#0b0b0b]/80 rounded-2xl p-4 border border-white/5" style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
      <h3 className="text-sm font-semibold text-neutral-300 mb-2">Presets</h3>

      <div className="mb-3">
        <div className="text-xs text-neutral-500 mb-2">Mood</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {MOODS.map(m => optionBtn(mood, setMood)(m))}
        </div>
      </div>

      <div className="mb-3">
        <div className="text-xs text-neutral-500 mb-2">Genre</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {GENRES.map(g => optionBtn(genre, setGenre)(g))}
        </div>
      </div>

      <div className="mb-3">
        <div className="text-xs text-neutral-500 mb-2">Instrument</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {INSTRUMENTS.map(i => optionBtn(instrument, setInstrument)(i))}
        </div>
      </div>

      <div className="mb-4">
        <div className="text-xs text-neutral-500 mb-2">Modifier</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {MODIFIERS.map(m => optionBtn(modifier, setModifier)(m))}
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={add} className="flex-1 px-4 py-2 rounded-xl bg-[#ff9cd6] text-black font-bold">Add Preset</button>
        <button onClick={() => { setMood(null); setGenre(null); setInstrument(null); setModifier(null); }} className="px-3 py-2 rounded-xl bg-neutral-900 text-neutral-300 border border-neutral-800">Clear</button>
      </div>
    </div>
  );
}

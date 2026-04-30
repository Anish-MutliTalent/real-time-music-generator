import React, { useEffect, useState } from 'react';
import { musicService } from '../services/musicService';
import WaveEditor from './WaveEditor';

type TrackEdit = {
  id: string;
  name: string;
  buffer: AudioBuffer;
  startTime: number;
  duration: number;
  selected: boolean;
  trimStart: number;
  trimEnd: number;
  gain: number;
  offset: number;
};

export default function ExportPanel() {
  const [status, setStatus] = useState<string | null>(null);
  const [tracks, setTracks] = useState<TrackEdit[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'select'|'trim'|'split'|'envelope'>('select');

  useEffect(() => {
    let mounted = true;
    (async () => {
      setStatus('Loading sessions...');
      const sessions = musicService.getSessions();
      const out: TrackEdit[] = [];
      for (let i = 0; i < sessions.length; i++) {
        const s: any = sessions[i];
        try {
          const buf = await musicService.getMixedSessionBuffer(s.id);
          if (!buf) continue;
          if (!mounted) return;
          out.push({
            id: s.id,
            name: `Session ${i + 1}`,
            buffer: buf,
            startTime: s.startTime,
            duration: buf.duration,
            selected: true,
            trimStart: 0,
            trimEnd: buf.duration,
            gain: 1,
            offset: 0
          });
        } catch (e) { console.warn('Failed to mix session', s.id, e); }
      }
      if (mounted) {
        setTracks(out);
        setStatus(null);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const previewTrack = async (t: TrackEdit) => {
    setStatus('Previewing...');
    try {
      await musicService.playBufferPreview(t.buffer, t.trimStart, t.trimEnd, t.gain);
      setStatus(null);
    } catch (e) {
      console.error(e);
      setStatus('Preview failed');
    }
  };

  const splitTrack = (id: string, at: number) => {
    setTracks(prev => {
      const found = prev.find(p => p.id === id);
      if (!found) return prev;
      const absAt = Math.max(found.trimStart, Math.min(found.trimEnd, at));
      const first: TrackEdit = { ...found, id: found.id + '-a', name: found.name + ' A', trimEnd: absAt };
      const second: TrackEdit = { ...found, id: found.id + '-b', name: found.name + ' B', trimStart: absAt };
      return prev.flatMap(p => p.id === id ? [first, second] : [p]);
    });
  };

  // Simple waveform draw helper
  const drawWaveform = (canvas: HTMLCanvasElement, buffer: AudioBuffer | null, trimStart: number, trimEnd: number) => {
    if (!canvas || !buffer) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width = canvas.clientWidth * (window.devicePixelRatio || 1);
    const h = canvas.height = 80 * (window.devicePixelRatio || 1);
    ctx.clearRect(0,0,w,h);
    const data = buffer.getChannelData(0);
    const len = data.length;
    const startSample = Math.floor(trimStart * buffer.sampleRate);
    const endSample = Math.min(len, Math.floor(trimEnd * buffer.sampleRate));
    const slice = data.subarray(startSample, endSample);
    const step = Math.ceil(slice.length / w);
    ctx.fillStyle = '#071016';
    ctx.fillRect(0,0,w,h);
    ctx.fillStyle = '#7dd3fc';
    for (let i=0;i<w;i++){
      const idx = i*step;
      let min=0,max=0;
      for (let j=0;j<step && (idx+j)<slice.length;j++){ const v = slice[idx+j]; if (v<min) min=v; if (v>max) max=v; }
      const y1 = (1 - (max+1)/2) * h; const y2 = (1 - (min+1)/2) * h;
      ctx.fillRect(i, y1, 1, Math.max(1, y2 - y1));
    }
  };

  function Waveform({ buffer, trimStart, trimEnd, onTrim }: { buffer: AudioBuffer | null; trimStart: number; trimEnd: number; onTrim: (s:number,e:number)=>void }) {
    const ref = React.useRef<HTMLCanvasElement | null>(null);
    const drag = React.useRef<{ which: 'left'|'right'|null, startX: number } | null>(null);

    React.useEffect(() => {
      if (!ref.current) return;
      drawWaveform(ref.current, buffer, trimStart, trimEnd);
    }, [buffer, trimStart, trimEnd]);

    const toTime = (x: number) => {
      const c = ref.current; if (!c || !buffer) return 0;
      const rect = c.getBoundingClientRect();
      const rel = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
      return buffer.duration * rel;
    };

    const onDown = (e: React.MouseEvent) => {
      const t = toTime(e.clientX);
      // choose nearest edge
      const leftDist = Math.abs(t - trimStart);
      const rightDist = Math.abs(t - trimEnd);
      drag.current = { which: leftDist < rightDist ? 'left' : 'right', startX: e.clientX };
      window.addEventListener('mousemove', onMove as any);
      window.addEventListener('mouseup', onUp as any);
    };

    const onMove = (e: MouseEvent) => {
      if (!drag.current || !ref.current || !buffer) return;
      const t = toTime(e.clientX);
      if (drag.current.which === 'left') {
        const newStart = Math.max(0, Math.min(t, trimEnd - 0.05));
        onTrim(newStart, trimEnd);
      } else {
        const newEnd = Math.min(buffer.duration, Math.max(t, trimStart + 0.05));
        onTrim(trimStart, newEnd);
      }
    };

    const onUp = (e: MouseEvent) => {
      drag.current = null;
      window.removeEventListener('mousemove', onMove as any);
      window.removeEventListener('mouseup', onUp as any);
    };

    return <canvas ref={ref} onMouseDown={onDown} className="w-full h-20 rounded bg-[#071016]" />;
  }

  const updateTrack = (id: string, fn: (t: TrackEdit) => TrackEdit) => {
    setTracks(prev => prev.map(p => p.id === id ? fn(p) : p));
  };

  const handleExport = async () => {
    const selected = tracks.filter(t => t.selected);
    if (selected.length === 0) { setStatus('Select at least one track'); return; }
    setLoading(true);
    setStatus('Rendering export...');
    try {
      const edits = selected.map(s => ({ buffer: s.buffer, trimStart: s.trimStart, trimEnd: s.trimEnd, gain: s.gain, offset: s.offset }));
      const res = await musicService.exportCustomMix(edits);
      if (!res) { setStatus('Nothing to export'); setLoading(false); return; }
      downloadBlob(res.blob, res.filename);
      setStatus('Export downloaded');
    } catch (e) {
      console.error(e);
      setStatus('Export failed');
    }
    setLoading(false);
  };

  return (
    <div className="w-[min(100%,720px)] bg-[#0b0b0b]/90 rounded-2xl p-6 border border-white/5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-neutral-200">Export & Edit</h3>
        <div className="text-sm text-neutral-400">One-click export; select tracks to include</div>
      </div>

      {tracks.length === 0 && <div className="text-sm text-neutral-400">No recorded audio available to export.</div>}

      <div className="flex flex-col gap-3">
        {tracks.map(t => (
          <div key={t.id} className="bg-[#0a0a0a] p-3 rounded-lg border border-white/6 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <input type="checkbox" checked={t.selected} onChange={(e) => updateTrack(t.id, x => ({ ...x, selected: e.target.checked }))} />
                <div className="font-semibold text-neutral-100">{t.name}</div>
                <div className="text-xs text-neutral-500">{t.duration.toFixed(2)}s</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => previewTrack(t)} className="px-3 py-1 rounded bg-neutral-800 text-neutral-200">Preview</button>
                <button onClick={() => splitTrack(t.id, t.trimStart + (t.trimEnd - t.trimStart) / 2)} className="px-3 py-1 rounded bg-neutral-800 text-neutral-200">Split</button>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="text-sm text-neutral-400">Mode:</div>
                <div className="flex gap-2">
                  <button onClick={() => setMode('select')} className={`px-2 py-1 rounded ${mode==='select' ? 'bg-[#ff9cd6] text-black' : 'bg-neutral-800 text-neutral-200'}`}>Select</button>
                  <button onClick={() => setMode('trim')} className={`px-2 py-1 rounded ${mode==='trim' ? 'bg-[#ff9cd6] text-black' : 'bg-neutral-800 text-neutral-200'}`}>Trim</button>
                  <button onClick={() => setMode('split')} className={`px-2 py-1 rounded ${mode==='split' ? 'bg-[#ff9cd6] text-black' : 'bg-neutral-800 text-neutral-200'}`}>Split</button>
                  <button onClick={() => setMode('envelope')} className={`px-2 py-1 rounded ${mode==='envelope' ? 'bg-[#ff9cd6] text-black' : 'bg-neutral-800 text-neutral-200'}`}>Envelope</button>
                </div>
              </div>

              <WaveEditor buffer={t.buffer} onTrimChange={(s,e) => updateTrack(t.id, x => ({ ...x, trimStart: s, trimEnd: e }))} onSplit={(time) => splitTrack(t.id, time)} onPreview={() => previewTrack(t)} theme={{ waveColor: '#7dd3fc', progressColor: '#ff9cd6', cursorColor: '#fef2f2' }} />

              <div className="flex gap-3 items-center mt-3">
                <div className="text-xs text-neutral-400 w-20">Gain</div>
                <input type="range" min={0} max={2} step={0.01} value={t.gain} onChange={(e) => updateTrack(t.id, x => ({ ...x, gain: parseFloat(e.target.value) }))} />
              </div>

              <div className="flex gap-3 items-center mt-2">
                <div className="text-xs text-neutral-400 w-20">Offset</div>
                <input type="number" step="0.1" min={0} value={t.offset} onChange={(e) => updateTrack(t.id, x => ({ ...x, offset: Math.max(0, parseFloat(e.target.value) || 0) }))} className="w-24 p-1 rounded bg-[#040404]" />
                <div className="text-xs text-neutral-500">Start time (s) in final mix</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-end gap-3">
        <button onClick={handleExport} className="px-6 py-2 rounded-xl bg-[#ff9cd6] text-black font-bold">{loading ? 'Rendering...' : 'Export Selected'}</button>
      </div>

      {status && <div className="text-xs text-neutral-400 mt-3">{status}</div>}
    </div>
  );
}

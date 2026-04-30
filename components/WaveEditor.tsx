import React, { useEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions';

type Props = {
  buffer: AudioBuffer | null;
  onTrimChange?: (start: number, end: number) => void;
  onSplit?: (time: number) => void;
  onPreview?: () => void;
  theme?: { waveColor?: string; progressColor?: string; cursorColor?: string; background?: string };
};

export default function WaveEditor({ buffer, onTrimChange, onSplit, onPreview, theme }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WaveSurfer | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      backend: 'WebAudio',
      cursorWidth: 2,
      height: 140,
      scrollParent: false,
      barWidth: 2,
      normalize: true,
      waveColor: theme?.waveColor || '#0b2a33',
      progressColor: theme?.progressColor || '#ff9cd6',
      cursorColor: theme?.cursorColor || '#ff9cd6',
      plugins: [
        RegionsPlugin.create({})
      ],
    });

    wsRef.current = ws;

    ws.on('region-updated', (region: any) => {
      if (onTrimChange) onTrimChange(region.start, region.end);
    });

    ws.on('region-update-end', (region: any) => {
      if (onTrimChange) onTrimChange(region.start, region.end);
    });

    ws.on('ready', () => {
      // create an initial full-length region for trimming
      const existing = Object.values(ws.regions.list || {});
      if (existing.length === 0) {
        const r = ws.addRegion({ start: 0, end: ws.getDuration(), drag: true, resize: true, color: 'rgba(125,211,252,0.06)' });
        // style region handles for better visibility
        try {
          const root = containerRef.current;
          if (root) {
            const style = document.createElement('style');
            style.innerHTML = `
              .wavesurfer-region { border-left: 2px solid rgba(255,156,214,0.95) !important; border-right: 2px solid rgba(255,156,214,0.95) !important; box-shadow: none !important; }
              .wavesurfer-region .wavesurfer-handle { width: 12px !important; background: rgba(255,156,214,1) !important; border-radius: 2px !important; }
              .wavesurfer-cursor { background: ${theme?.cursorColor || '#ff9cd6'} !important; width: 2px !important; }
              .wave-timeline { color: #9ca3af; font-size: 12px; }
            `;
            root.appendChild(style);
          }
        } catch (e) { /* ignore */ }
      }
    });

    // double-click to add a split marker (tiny region) at clicked time
    const onDbl = (ev: MouseEvent) => {
      if (!ws) return;
      const rect = containerRef.current!.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const t = (x / rect.width) * ws.getDuration();
      // add a tiny region to mark split
      ws.addRegion({ start: Math.max(0, t - 0.001), end: Math.min(ws.getDuration(), t + 0.001), color: 'rgba(255,156,214,0.95)', drag: false, resize: false });
      if (onSplit) onSplit(t);
    };
    containerRef.current.addEventListener('dblclick', onDbl as any);

    return () => {
      try { ws.destroy(); } catch (e) {}
      wsRef.current = null;
      if (containerRef.current) containerRef.current.removeEventListener('dblclick', onDbl as any);
    };
  }, []);

  useEffect(() => {
    if (!wsRef.current) return;
    const ws = wsRef.current;
    if (!buffer) { ws.empty(); return; }
    // Load decoded buffer directly so no XHR needed
    try {
      ws.loadDecodedBuffer(buffer);
    } catch (e) {
      console.warn('WaveSurfer loadDecodedBuffer failed, falling back to empty', e);
      ws.empty();
    }
  }, [buffer]);

  const addSplitAt = (t: number) => {
    if (!wsRef.current) return;
    // create a small region marking split point
    wsRef.current.addRegion({ start: t - 0.001, end: t + 0.001, color: 'rgba(255,156,214,0.9)', drag: false, resize: false });
    if (onSplit) onSplit(t);
  };

  return (
    <div className="w-full">
      <div ref={containerRef} className="w-full bg-[#071016] rounded overflow-hidden shadow-sm" style={{ border: '1px solid rgba(255,255,255,0.04)' }} />
      
      <div className="mt-2 flex items-center gap-3 text-sm text-neutral-300">
        <button onClick={() => wsRef.current?.playPause()} className="px-3 py-1 rounded bg-neutral-800 text-white">Play/Pause</button>
        <button onClick={() => wsRef.current?.zoom((wsRef.current?.params?.barWidth || 2) * 2)} className="px-3 py-1 rounded bg-neutral-800 text-white">Zoom In</button>
        <button onClick={() => wsRef.current?.zoom(0)} className="px-3 py-1 rounded bg-neutral-800 text-white">Reset Zoom</button>
        <div className="text-neutral-400">Double‑click waveform to add split marker. Drag region edges to trim.</div>
      </div>
    </div>
  );
}

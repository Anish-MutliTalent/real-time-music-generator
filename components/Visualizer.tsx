
import React, { useEffect, useRef } from 'react';
import { musicService } from '../services/musicService';
import { VisualizerChunk, VisualizerEvent } from '../types';

interface VisualizerProps {
  isPlaying: boolean;
}

const Visualizer: React.FC<VisualizerProps> = ({ isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const chunksRef = useRef<VisualizerChunk[]>([]);

  useEffect(() => {
    // Subscribe to MusicService updates
    const unsubscribe = musicService.subscribe((event: VisualizerEvent) => {
      if (event.type === 'chunk' && event.chunk) {
        // Add new chunk to our list
        chunksRef.current.push(event.chunk);
        
        // Prune old chunks (older than 10 seconds ago to keep memory low)
        const now = musicService.getCurrentTime();
        chunksRef.current = chunksRef.current.filter(c => c.startTime + c.duration > now - 10);
      } else if (event.type === 'reset') {
        chunksRef.current = [];
      } else if (event.type === 'trim' && event.time !== undefined) {
         // Remove future chunks that were trimmed
         const cutoff = event.time;
         chunksRef.current = chunksRef.current.filter(c => c.startTime <= cutoff);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;
      const currentTime = musicService.getCurrentTime();
      
      ctx.clearRect(0, 0, width, height);

      // --- 1. Draw Playhead (Center Line) ---
      const playheadX = width / 2;
      ctx.strokeStyle = '#ff9cd6';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();

      // --- 2. Render Chunks ---
      // Scale: How many pixels per second?
      const pixelsPerSecond = 100; 

      chunksRef.current.forEach(chunk => {
        // Check if chunk is visible
        // Chunk Start X = playheadX + (chunk.startTime - currentTime) * scale
        // If chunk is in the future, (startTime - currentTime) is positive -> to the right.
        // If chunk is past, negative -> to the left.
        
        const relativeStartSeconds = chunk.startTime - currentTime;
        const startX = playheadX + relativeStartSeconds * pixelsPerSecond;
        const endX = startX + chunk.duration * pixelsPerSecond;

        // Skip if completely off screen
        if (endX < 0 || startX > width) return;

        // Animation: Fade and Slide Down on entry
        const age = Date.now() - chunk.receivedAt;
        const animationDuration = 600; // ms
        let alpha = 1.0;
        let yOffset = 0;

        if (age < animationDuration) {
           const progress = age / animationDuration;
           // Ease out cubic
           const ease = 1 - Math.pow(1 - progress, 3);
           alpha = ease;
           yOffset = (1 - ease) * -30; // Slide from 30px above
        }

        ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1.5;
        ctx.beginPath();

        // Draw Envelope
        const envelope = chunk.data;
        const len = envelope.length / 2; // number of min/max pairs
        
        // Calculate step in pixels
        // total duration width = (chunk.duration * pixelsPerSecond)
        // points = len
        // pixels per point = width / len
        const chunkWidth = chunk.duration * pixelsPerSecond;
        const pixelStep = chunkWidth / len;

        for (let i = 0; i < len; i++) {
           const x = startX + i * pixelStep;
           // If x is outside, skip drawing this line for perf, but continue loop
           if (x < -5 || x > width + 5) continue;
           
           const min = envelope[i * 2];
           const max = envelope[i * 2 + 1];

           // Apply Y Offset from animation
           const yTop = centerY + min * (height * 0.4) + yOffset;
           const yBottom = centerY + max * (height * 0.4) + yOffset;
           
           ctx.moveTo(x, yTop);
           ctx.lineTo(x, yBottom);
        }
        ctx.stroke();
      });

      // Reset Alpha
      ctx.globalAlpha = 1.0;

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);

    return () => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying]);

  return (
    <canvas 
      ref={canvasRef} 
      width={1200} // High resolution width
      height={120} 
      className="w-full h-full"
    />
  );
};

export default Visualizer;

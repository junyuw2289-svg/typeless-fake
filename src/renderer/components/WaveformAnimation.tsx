import React, { useEffect, useRef } from 'react';

interface WaveformAnimationProps {
  analyser: AnalyserNode | null;
  isActive: boolean;
}

const BAR_COUNT = 11;
const BAR_WIDTH = 3;
const BAR_GAP = 2;
const BAR_MAX_HEIGHT = 20;

const BASE_HEIGHTS = [3, 5, 8, 12, 16, 20, 16, 12, 8, 5, 3];
const PHASE_OFFSETS = [0.40, 0.32, 0.24, 0.16, 0.08, 0, 0.08, 0.16, 0.24, 0.32, 0.40];

export const WaveformAnimation: React.FC<WaveformAnimationProps> = ({ analyser, isActive }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const totalWidth = BAR_COUNT * (BAR_WIDTH + BAR_GAP) - BAR_GAP;
    canvas.width = totalWidth;
    canvas.height = BAR_MAX_HEIGHT;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const dataArray = new Uint8Array(analyser?.frequencyBinCount || BAR_COUNT);
      if (analyser && isActive) {
        analyser.getByteFrequencyData(dataArray);
      }

      const center = Math.floor(BAR_COUNT / 2);

      for (let i = 0; i < BAR_COUNT; i++) {
        let height: number;
        const dist = Math.abs(i - center);

        if (analyser && isActive) {
          const dataIndex = Math.floor((dist / (center + 1)) * dataArray.length * 0.5);
          const value = dataArray[dataIndex] / 255;
          const minH = BASE_HEIGHTS[i] * 0.2;
          height = minH + value * (BAR_MAX_HEIGHT - minH);
        } else if (isActive) {
          const time = Date.now() / 1000;
          const phase = PHASE_OFFSETS[i];
          const wave1 = Math.sin(2 * Math.PI * 1.3 * (time - phase));
          const wave2 = Math.sin(2 * Math.PI * 2.6 * (time - phase * 1.5));
          const scale = 0.15 + 0.85 * Math.max(0, 0.5 + 0.35 * wave1 + 0.15 * wave2);
          height = BASE_HEIGHTS[i] * scale;
        } else {
          height = BASE_HEIGHTS[i];
        }

        const x = i * (BAR_WIDTH + BAR_GAP);
        const y = (BAR_MAX_HEIGHT - height) / 2;

        ctx.fillStyle = '#d97757';
        ctx.beginPath();
        ctx.roundRect(x, y, BAR_WIDTH, height, 1.5);
        ctx.fill();
      }

      if (isActive) {
        animationRef.current = requestAnimationFrame(draw);
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [analyser, isActive]);

  const totalWidth = BAR_COUNT * (BAR_WIDTH + BAR_GAP) - BAR_GAP;

  return (
    <canvas
      ref={canvasRef}
      width={totalWidth}
      height={BAR_MAX_HEIGHT}
      style={{ width: totalWidth, height: BAR_MAX_HEIGHT }}
    />
  );
};

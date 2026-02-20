import React, { useEffect, useRef } from 'react';

interface WaveformAnimationProps {
  analyser: AnalyserNode | null;
  isActive: boolean;
}

const BAR_COUNT = 12;
const BAR_WIDTH = 3;
const BAR_GAP = 2;
const BAR_MIN_HEIGHT = 3;
const BAR_MAX_HEIGHT = 24;

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

      for (let i = 0; i < BAR_COUNT; i++) {
        let height: number;

        if (analyser && isActive) {
          // Map frequency data to bar height
          const dataIndex = Math.floor((i / BAR_COUNT) * dataArray.length);
          const value = dataArray[dataIndex] / 255;
          height = BAR_MIN_HEIGHT + value * (BAR_MAX_HEIGHT - BAR_MIN_HEIGHT);
        } else if (isActive) {
          // Fallback animation when no analyser
          const time = Date.now() / 200;
          height = BAR_MIN_HEIGHT + Math.abs(Math.sin(time + i * 0.5)) * (BAR_MAX_HEIGHT - BAR_MIN_HEIGHT) * 0.6;
        } else {
          height = BAR_MIN_HEIGHT;
        }

        const x = i * (BAR_WIDTH + BAR_GAP);
        const y = (BAR_MAX_HEIGHT - height) / 2;

        ctx.fillStyle = '#3B82F6'; // Blue
        ctx.beginPath();
        ctx.roundRect(x, y, BAR_WIDTH, height, 1.5);
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(draw);
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

"use client";

import { useEffect, useRef } from "react";

const MARKS = ".....::::----++++****";

type MatrixRainProps = {
  color?: string;
  intensity?: number;
  speed?: number;
};

export default function MatrixRain({
  color = "143, 179, 255",
  intensity = 1,
  speed = 0.35,
}: MatrixRainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const fontSize = 16;
    let columns = 0;
    let drops: number[] = [];
    let animationFrame = 0;
    let lastTick = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      columns = Math.ceil(canvas.width / fontSize);
      drops = Array.from({ length: columns }, () =>
        Math.floor((Math.random() * canvas.height) / fontSize),
      );
      ctx.fillStyle = "#090b10";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const draw = (time: number) => {
      animationFrame = window.requestAnimationFrame(draw);
      if (time - lastTick < 42 / speed) return;
      lastTick = time;

      ctx.fillStyle = "rgba(9, 11, 16, 0.1)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${fontSize}px Arial`;

      for (let i = 0; i < columns; i += 1) {
        const mark = MARKS[Math.floor(Math.random() * MARKS.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        ctx.fillStyle = `rgba(${color}, ${0.7 * intensity})`;
        ctx.fillText(mark, x, y);

        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i] += 1;
      }
    };

    resize();
    window.addEventListener("resize", resize);

    if (reduceMotion) {
      ctx.font = `${fontSize}px Arial`;
      for (let i = 0; i < columns; i += 1) {
        for (let j = 0; j < 12; j += 1) {
          const mark = MARKS[Math.floor(Math.random() * MARKS.length)];
          ctx.fillStyle = `rgba(${color}, ${Math.random() * 0.25 * intensity})`;
          ctx.fillText(mark, i * fontSize, Math.random() * canvas.height);
        }
      }
    } else {
      animationFrame = window.requestAnimationFrame(draw);
    }

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
    };
  }, [color, intensity, speed]);

  return (
    <div className="stage-fixed z-0" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}

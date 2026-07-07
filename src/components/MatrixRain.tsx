"use client";

import { useEffect, useRef } from "react";

const GLYPHS =
  "アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEFXYZ<>/\\{}[]$#*+=";

type MatrixRainProps = {
  /** rgb triplet, e.g. "0, 255, 102" */
  color?: string;
  /** 0..1 — overall strength of the effect */
  intensity?: number;
  /** 1 = original speed; lower is slower */
  speed?: number;
};

export default function MatrixRain({
  color = "0, 255, 102",
  intensity = 1,
  speed = 0.45,
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
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const draw = (time: number) => {
      animationFrame = window.requestAnimationFrame(draw);
      // glyphs advance one row per tick, so the interval sets the fall speed
      if (time - lastTick < 33 / speed) return;
      lastTick = time;

      ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < columns; i += 1) {
        const glyph = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        // bright head with dimmer trail handled by the fade fill above
        ctx.fillStyle = `rgba(${color}, ${0.9 * intensity})`;
        ctx.fillText(glyph, x, y);

        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i] += 1;
      }
    };

    resize();
    window.addEventListener("resize", resize);

    if (reduceMotion) {
      // Render a single static frame instead of animating
      ctx.font = `${fontSize}px monospace`;
      for (let i = 0; i < columns; i += 1) {
        for (let j = 0; j < 14; j += 1) {
          const glyph = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          ctx.fillStyle = `rgba(${color}, ${Math.random() * 0.35 * intensity})`;
          ctx.fillText(
            glyph,
            i * fontSize,
            Math.random() * (canvas.height ?? 0),
          );
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

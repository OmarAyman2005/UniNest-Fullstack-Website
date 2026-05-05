"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Global Toast component
 * Props:
 * - message: string
 * - type: "success" | "error" | "warning"
 * - duration: number (ms) 0 = persistent until programmatic close
 * - onClose: function called when toast finishes its duration
 *
 * Uses design tokens from globals.css (bg-success, bg-error, bg-highlight, text-root-primary, shadow-elevated, etc.)
 */
export default function Toast({ message = "", type = "success", duration = 4000, onClose }) {
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(100);
  const timerRef = useRef(null);
  const startRef = useRef(null);
  const remainingRef = useRef(duration);

  const colorClass =
    type === "error"
      ? "bg-error text-root-primary"
      : type === "warning"
      ? "bg-highlight text-root-primary"
      : "bg-success text-root-primary";

  useEffect(() => {
    if (!duration || duration <= 0) return undefined;

    const start = Date.now();
    startRef.current = start;
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const pct = Math.max(0, 100 - Math.round((elapsed / duration) * 100));
      setProgress(pct);
      if (elapsed >= duration) {
        clearInterval(timerRef.current);
        setVisible(false);
        onClose?.();
      }
    }, 100);

    return () => {
      clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  // Pause/resume on hover (keeps behavior but does not allow manual dismissal)
  const handleMouseEnter = () => {
    if (!duration || duration <= 0) return;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      const elapsed = Date.now() - startRef.current;
      remainingRef.current = Math.max(0, duration - elapsed);
    }
  };

  const handleMouseLeave = () => {
    if (!duration || duration <= 0) return;
    const rem = remainingRef.current;
    startRef.current = Date.now();
    const newDuration = rem;
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const pct = Math.max(0, 100 - Math.round((elapsed / newDuration) * 100));
      setProgress(pct);
      if (elapsed >= newDuration) {
        clearInterval(timerRef.current);
        setVisible(false);
        onClose?.();
      }
    }, 100);
  };

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`${colorClass} relative w-full max-w-xl rounded-2xl shadow-elevated p-3 flex items-center justify-center`}
      style={{ boxSizing: "border-box" }}
    >
      <div className="text-sm leading-tight text-root-primary text-center">
        {message}
      </div>

      {/* progress bar */}
      {duration > 0 && (
        <div className="absolute left-0 right-0 bottom-0 h-1 rounded-b-2xl overflow-hidden" style={{ margin: 0 }}>
          <div
            className="h-full bg-root-primary/30"
            style={{ width: `${progress}%`, transition: "width 120ms linear" }}
          />
        </div>
      )}
    </div>
  );
}
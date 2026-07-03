"use client";

import { createContext, useContext, useEffect, useState } from "react";

const AboutContext = createContext<(() => void) | null>(null);

export function useOpenAbout() {
  const ctx = useContext(AboutContext);
  if (!ctx) throw new Error("useOpenAbout must be used within AboutProvider");
  return ctx;
}

export function AboutProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <AboutContext.Provider value={() => setOpen(true)}>
      {children}

      <div
        className={`scrim${open ? "" : " hidden"}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
      >
        <div className="card">
          <button className="cardx" onClick={() => setOpen(false)}>
            ✕
          </button>
          <h2>Thunder/Lightning</h2>
          <div className="sub">A Love Letter to Music Videos</div>
          <p>
            An ever-growing collection of music videos I keep returning to. Connected as a stream of
            consciousness. Follow any thread.
          </p>
          <div className="credit">
            <a href="https://higafox.com" target="_blank" rel="noopener">
              higafox.com
            </a>
          </div>
        </div>
      </div>
    </AboutContext.Provider>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function Topbar() {
  const pathname = usePathname();
  const [aboutOpen, setAboutOpen] = useState(false);

  const onPlayer = pathname === "/" || pathname.startsWith("/video/");
  const onArchive = pathname.startsWith("/archive");

  useEffect(() => {
    if (!aboutOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAboutOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [aboutOpen]);

  return (
    <>
      <div className="topbar">
        <div className="brand">
          <Link className="brandLink" href="/">
            Thunder/Lightning
          </Link>{" "}
          · a love letter to music videos
        </div>
        <div className="navlinks">
          <Link className={`navlink${onPlayer ? " on" : ""}`} href="/">
            Player
          </Link>
          <Link className={`navlink${onArchive ? " on" : ""}`} href="/archive">
            Archive
          </Link>
          <button className="navlink" onClick={() => setAboutOpen(true)}>
            About
          </button>
        </div>
      </div>

      <div
        className={`scrim${aboutOpen ? "" : " hidden"}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setAboutOpen(false);
        }}
      >
        <div className="card">
          <button className="cardx" onClick={() => setAboutOpen(false)}>
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
    </>
  );
}

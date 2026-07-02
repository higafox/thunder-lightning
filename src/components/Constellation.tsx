"use client";

import { useLayoutEffect, useState, type RefObject } from "react";
import { buildConstellation, type ConstellationLayout, type NodeAction, type PlacedPill } from "@/lib/constellation";
import type { Counts, StreamState, Video } from "@/lib/types";

export function Constellation({
  video,
  counts,
  stream,
  cur,
  frameRef,
  onAction,
}: {
  video: Video;
  counts: Counts;
  stream: StreamState;
  cur: string;
  frameRef: RefObject<HTMLDivElement | null>;
  onAction: (action: NodeAction) => void;
}) {
  const [layout, setLayout] = useState<ConstellationLayout | null>(null);

  useLayoutEffect(() => {
    const frameEl = frameRef.current;
    if (!frameEl) return;
    const rect = frameEl.getBoundingClientRect();
    const next = buildConstellation({
      video,
      counts,
      stream,
      seedKey: cur,
      frameRect: { left: rect.left, right: rect.right, top: rect.top },
      viewport: { width: window.innerWidth, height: window.innerHeight },
    });
    setLayout(next);
    // recompute only when the video changes, mirroring the prototype which
    // rebuilds the whole constellation exactly once per play()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur]);

  if (!layout) return <div className="constellation" id="constellation" />;

  return (
    <div className="constellation" id="constellation">
      <svg className="wires" preserveAspectRatio="none" viewBox="0 0 100 100">
        {layout.rays.map((r, i) => (
          <line
            key={`ray-${i}`}
            x1={r.x1}
            y1={r.y1}
            x2={r.x2}
            y2={r.y2}
            className={r.cls}
            opacity={r.opacity != null ? r.opacity.toFixed(2) : undefined}
          />
        ))}
        {layout.connectors.map((c, i) => (
          <line key={`conn-${i}`} x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} className={c.cls} />
        ))}
      </svg>
      {layout.pills.map((p, i) => (
        <PillNode key={i} placed={p} onAction={onAction} />
      ))}
    </div>
  );
}

function PillNode({ placed, onAction }: { placed: PlacedPill; onAction: (a: NodeAction) => void }) {
  const n = placed.node;
  let cls = "node";
  if (n.kind === "tag") cls += " tag";
  else if (n.kind === "person") cls += " person";
  else if (n.kind === "terminal") cls += " terminal";
  else if (n.kind === "shuffle") cls += " control shuffle";
  else cls += " control";
  if (n.active) cls += " active";
  if (placed.anchor === "L") cls += " anchorL";
  else if (placed.anchor === "R") cls += " anchorR";

  return (
    <div className={cls} style={{ left: `${placed.x}%`, top: `${placed.y}%` }}>
      <span className="pill" onClick={n.action ? () => onAction(n.action) : undefined}>
        {n.label}
      </span>
    </div>
  );
}

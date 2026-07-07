import type { Counts, StreamState, Video } from "./types";

export type NodeKind = "tag" | "person" | "terminal" | "control" | "shuffle";

export type NodeAction =
  | { kind: "stream"; type: "tag" | "artist" | "director"; key: string }
  | { kind: "shuffle" }
  | { kind: "timeline"; dir: -1 | 1 }
  | null;

export interface ConstNode {
  kind: NodeKind;
  label: string;
  active: boolean;
  action: NodeAction;
}

export interface PlacedPill {
  x: number;
  y: number;
  anchor?: "L" | "R";
  cxPill: number;
  cyPill: number;
  node: ConstNode;
}

export interface RayLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  cls: "sun" | "ray" | "spoke";
  opacity?: number;
}

export interface ConnLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  cls: string;
}

export interface ConstellationLayout {
  rays: RayLine[];
  connectors: ConnLine[];
  pills: PlacedPill[];
}

const CX = 50;
const CY = 47.5; // video center in viewport %, block sits slightly lower

function angDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function seedRand(key: string) {
  let seed = 0;
  for (const ch of key) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

// approx pill half-width in viewport % (font ~16px, padding) to find its visual center
function halfW(label: string, viewportWidth: number): number {
  const chars = label.length;
  const px = chars * 9.2 + 48; // rough label width incl padding
  return (px / (viewportWidth || 1600)) * 100 / 2;
}

export function buildConstellation(params: {
  video: Video;
  counts: Counts;
  stream: StreamState;
  seedKey: string;
  frameRect: { left: number; right: number; top: number };
  viewport: { width: number; height: number };
}): ConstellationLayout {
  const { video: v, counts: CT, stream: s, seedKey, frameRect, viewport } = params;
  const AR = (viewport.width || 1600) / (viewport.height || 900);
  const rand = seedRand(seedKey);

  const rays: RayLine[] = [];
  const addRay = (ang: number, inner: number, len: number, cls: RayLine["cls"], op?: number) => {
    const x1 = CX + (Math.cos(ang) * inner) / AR;
    const y1 = CY + Math.sin(ang) * inner;
    const x2 = CX + (Math.cos(ang) * len) / AR;
    const y2 = CY + Math.sin(ang) * len;
    rays.push({ x1, y1, x2, y2, cls, opacity: op });
  };

  // sunburst: 120 thin radial lines fanning from center. lengths biased short
  // (squared random) so most stop soon past the frame, a few reach further.
  const SUN = 120;
  for (let i = 0; i < SUN; i++) {
    const jitter = (rand() - 0.5) * ((Math.PI * 2) / SUN) * 1.4;
    const a = (i / SUN) * Math.PI * 2 + jitter;
    if (Math.abs(Math.cos(a)) < 0.1) continue; // skip near-vertical
    const inner = 7;
    const r = rand() * rand();
    const len = 72 + r * 60;
    addRay(a, inner, len, "sun");
  }

  // ambient short rays (dense, faint)
  const RAYS = 44;
  for (let i = 0; i < RAYS; i++) {
    const ang = (i / RAYS) * Math.PI * 2 + (rand() - 0.5) * 0.35;
    if (Math.abs(Math.cos(ang)) < 0.12) continue;
    const inner = 6 + rand() * 10;
    const len = inner + 14 + rand() * 36;
    addRay(ang, inner, len, "ray", 0.13 + rand() * 0.22);
  }

  // ornamental long spokes that go nowhere
  const SPOKES = 10;
  for (let i = 0; i < SPOKES; i++) {
    const ang = (i / SPOKES) * Math.PI * 2 + (rand() - 0.5) * 0.5;
    if (Math.abs(Math.cos(ang)) < 0.14) continue;
    const inner = 8 + rand() * 8;
    const len = inner + 50 + rand() * 40;
    addRay(ang, inner, len, "spoke", 0.13 + rand() * 0.16);
  }

  // tags sorted by global popularity
  const tags = [...v.tags].sort((a, b) => (CT.tags[b] || 0) - (CT.tags[a] || 0));
  const tagNodes: ConstNode[] = tags.map((t) => {
    const count = CT.tags[t] || 0;
    return count > 1
      ? { kind: "tag" as const, label: t, active: s.type === "tag" && s.key === t, action: { kind: "stream" as const, type: "tag" as const, key: t } }
      : { kind: "terminal" as const, label: t, active: false, action: null };
  });

  // artist/director "person" pills: followable when they have 2+ videos
  const personNodes: ConstNode[] = [];
  if ((CT.artists[v.artist] || 0) > 1) {
    personNodes.push({
      kind: "person",
      label: v.artist.toLowerCase(),
      active: s.type === "artist" && s.key === v.artist,
      action: { kind: "stream", type: "artist", key: v.artist },
    });
  }
  // A director affiliate pools into the same "directors" counts/playlist as
  // a regular director credit (see sync.ts), so it's followed with the same
  // "director" stream type -- the same name credited as director on one
  // video and affiliate on another is one entity, not two disconnected pills.
  const creditedNames = [...(v.directors || [])];
  if (v.directorAffiliate && !creditedNames.includes(v.directorAffiliate)) {
    creditedNames.push(v.directorAffiliate);
  }
  creditedNames.forEach((d) => {
    // a band that (co-)directs its own video (e.g. OK Go) is the same entity
    // as the artist pill above -- don't show it a second time as a director.
    if (d.toLowerCase() === v.artist.toLowerCase()) return;
    if ((CT.directors[d] || 0) > 1) {
      personNodes.push({
        kind: "person",
        label: d.toLowerCase(),
        active: s.type === "director" && s.key === d,
        action: { kind: "stream", type: "director", key: d },
      });
    }
  });

  // person pills lead (prime spots), then tags. split alternately into rails.
  const allNodes = [...personNodes, ...tagNodes];
  const left: ConstNode[] = [];
  const right: ConstNode[] = [];
  allNodes.forEach((n, i) => {
    (i % 2 === 0 ? left : right).push(n);
  });

  const placed: PlacedPill[] = [];

  // Shuffle crown: top center, highest
  placed.push({
    x: 50,
    y: 11,
    cxPill: 50,
    cyPill: 11,
    node: { kind: "shuffle", label: "Shuffle", active: s.type === "shuffle", action: { kind: "shuffle" } },
  });

  // measure the actual frame box so controls align to its real edges
  const vw2 = viewport.width || 1600;
  const vh2 = viewport.height || 900;
  const frameLeft = (frameRect.left / vw2) * 100;
  const frameRight = (frameRect.right / vw2) * 100;
  const frameTop = (frameRect.top / vh2) * 100;
  // frame moved down 1.5pts (padding-top 5vh -> 8vh) to open up breathing room
  // below the controls; subtract that back out so Earlier/Later/Shuffle stay
  // put while the frame drops further below them.
  const ctrlY = Math.max(9, frameTop - 4 - 1.5);

  placed.push({
    x: frameLeft,
    y: ctrlY,
    anchor: "L",
    cxPill: frameLeft + halfW("← Earlier", vw2),
    cyPill: ctrlY,
    node: { kind: "control", label: "← Earlier", active: s.type === "timeline" && s.dir === -1, action: { kind: "timeline", dir: -1 } },
  });
  placed.push({
    x: frameRight,
    y: ctrlY,
    anchor: "R",
    cxPill: frameRight - halfW("Later →", vw2),
    cyPill: ctrlY,
    node: { kind: "control", label: "Later →", active: s.type === "timeline" && s.dir === 1, action: { kind: "timeline", dir: 1 } },
  });

  // A pill's connector runs from dead center straight to it; if that angle
  // ends up too close to flat (0/180deg), the connector is a long thin
  // near-horizontal line -- the hardest case for antialiasing, since a tiny
  // deviation from exactly flat makes the rasterizer stair-step between
  // pixel rows over its length instead of blending smoothly. Nudge the pill
  // vertically just enough to clear that danger zone. (Ambient decorative
  // rays don't get this treatment -- excluding them entirely left visible
  // gaps in the sunburst, and they're background flavor, not something
  // users read as a line to a specific place the way a pill connector is.)
  const FLAT_EPS = 0.11; // ~6.3deg off exactly horizontal
  const avoidFlatAngle = (cxPill: number, y: number): number => {
    const dx = (cxPill - CX) * AR;
    if (Math.abs(dx) < 0.001) return y;
    const minDy = Math.abs(dx) * Math.tan(FLAT_EPS);
    const dy = y - CY;
    if (Math.abs(dy) >= minDy) return y;
    return CY + (dy >= 0 ? minDy : -minDy);
  };

  // rails: place pills down each side. Sparse rails (1-2 pills) get a random
  // diagonal angle (20-50deg off horizontal) so connectors never run flat.
  const layRail = (arr: ConstNode[], side: "L" | "R") => {
    const n = arr.length;
    arr.forEach((node, i) => {
      let y: number;
      if (n >= 3) {
        const top = 24, bottom = 68;
        y = top + ((bottom - top) / (n - 1)) * i;
      } else {
        const deg = 20 + rand() * 30;
        const up = n === 2 ? i === 0 : rand() < 0.5;
        const rad = (deg * Math.PI) / 180;
        const dxPct = 42;
        const dyPct = dxPct * Math.tan(rad) * 0.62;
        y = 42 + (up ? -dyPct : dyPct);
        y = Math.max(20, Math.min(70, y));
      }
      const variation = [0, 3, 0.8, 3.4, 1.6, 2.4, 0.4, 2][(i * 2 + (side === "L" ? 0 : 1)) % 8];
      const hw = halfW(node.label, vw2);
      // long labels get pushed further toward the viewport edge so their
      // inner edge doesn't creep toward center/the frame on narrow viewports
      const extraPush = Math.min(10, Math.max(0, hw - 4) * 1.3);
      const x = side === "L" ? Math.max(1, 2 + variation - extraPush) : Math.min(99, 98 - variation + extraPush);
      const cxPill = side === "L" ? x + hw : x - hw;
      y = avoidFlatAngle(cxPill, y);
      placed.push({ x, y, anchor: side, cxPill, cyPill: y, node });
    });
  };
  layRail(left, "L");
  layRail(right, "R");

  // connector lines from center to each pill's visual center. Followable pills
  // (tag 2+, person, controls, shuffle) get a line extending past the frame;
  // terminal pills get a line that stops at the pill.
  const connectors: ConnLine[] = placed.map((p) => {
    const followable = p.node.kind === "tag" || p.node.kind === "person" || p.node.kind === "control" || p.node.kind === "shuffle";
    const tx = p.cxPill, ty = p.cyPill;
    let ex = tx, ey = ty;
    if (followable) {
      const dx = tx - CX, dy = ty - CY, len = Math.hypot(dx, dy) || 1;
      const reach = Math.max(len + 8, 60);
      ex = CX + (dx / len) * reach;
      ey = CY + (dy / len) * reach;
    }
    let cls = "conn";
    if (p.node.active) cls += " connActive";
    else if (!followable) cls += " connTerminal";
    return { x1: CX, y1: CY, x2: ex, y2: ey, cls };
  });

  // A decorative ray shares its origin (CX, CY) with every connector. If a
  // ray's angle nearly matches a connector's, the two lines overlap almost
  // perfectly near the center and only slowly diverge -- which reads as one
  // line with a visible kink where they finally separate, rather than two
  // distinct lines. Drop any ray within ~1 degree of a connector's angle.
  const connAngles = connectors.map((c) => Math.atan2(c.y2 - CY, (c.x2 - CX) * AR));
  const COLLIDE_EPS = 0.02;
  const clearRays = rays.filter((r) => {
    const rAng = Math.atan2(r.y1 - CY, (r.x1 - CX) * AR);
    return !connAngles.some((a) => Math.abs(angDiff(rAng, a)) < COLLIDE_EPS);
  });

  return { rays: clearRays, connectors, pills: placed };
}

import type { ManeuverArrow } from "@/lib/maneuver-vi";

/**
 * What one frame of the mini window needs to draw itself. Everything is
 * optional because navigation starts before the first GPS fix lands, and the
 * window has to show something sensible in the meantime.
 */
export type MiniNavFrame = {
  /** The active leg's line, [lng, lat] — the same one the turn banner reads. */
  route: number[][] | null;
  geo: { lat: number; lng: number } | null;
  /** Degrees clockwise from north. Null keeps the drawing north-up. */
  heading: number | null;
  turnArrow: ManeuverArrow | null;
  turnLabel: string | null;
  turnMetres: number | null;
  remainingMeters: number | null;
  remainingSeconds: number | null;
  destination: string | null;
  paused: boolean;
};

export const MINI_W = 480;
export const MINI_H = 270;

/** Where the rider sits on the canvas: low, so most of the frame is road ahead. */
const ANCHOR_Y = 190;
const FORWARD_PX = ANCHOR_Y - 84;

const IN = {
  ground: "#0b1220",
  panel: "rgba(9,14,26,0.92)",
  edge: "rgba(148,163,184,0.22)",
  road: "#38bdf8",
  roadCase: "#0e2a47",
  behind: "#334155",
  ink: "#f8fafc",
  muted: "#94a3b8",
  distance: "#7dd3fc",
  warn: "#fbbf24",
  rider: "#ffffff",
};

/** "200 m" / "4,2 km" — the written form, not the spoken one the voice uses. */
export function shortMetres(m: number): string {
  if (m < 950) return `${Math.max(0, Math.round(m / 10) * 10)} m`;
  const km = m / 1000;
  return km >= 10 ? `${Math.round(km)} km` : `${km.toFixed(1).replace(".", ",")} km`;
}

export function shortDuration(s: number): string {
  const mins = Math.max(1, Math.round(s / 60));
  if (mins < 60) return `${mins} phút`;
  const h = Math.floor(mins / 60);
  const rest = mins % 60;
  return rest ? `${h} giờ ${rest} phút` : `${h} giờ`;
}

function ellipsis(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > max) cut = cut.slice(0, -1);
  return `${cut}…`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Elbow angle of each manoeuvre, in degrees, positive to the right. */
const TURN_DEG: Partial<Record<ManeuverArrow, number>> = {
  straight: 0,
  "slight-left": -38,
  "slight-right": 38,
  left: -90,
  right: 90,
  "sharp-left": -128,
  "sharp-right": 128,
};

function drawArrow(ctx: CanvasRenderingContext2D, kind: ManeuverArrow, size: number) {
  const s = size;
  ctx.save();
  ctx.strokeStyle = IN.ink;
  ctx.fillStyle = IN.ink;
  ctx.lineWidth = Math.max(3, s * 0.13);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (kind === "destination") {
    // A pin, because "arrive" is a place rather than a direction.
    ctx.beginPath();
    ctx.arc(0, -s * 0.12, s * 0.26, Math.PI, 0);
    ctx.lineTo(0, s * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -s * 0.12, s * 0.1, 0, Math.PI * 2);
    ctx.fillStyle = IN.panel;
    ctx.fill();
    ctx.restore();
    return;
  }

  if (kind === "uturn") {
    ctx.beginPath();
    ctx.moveTo(-s * 0.22, s * 0.45);
    ctx.lineTo(-s * 0.22, -s * 0.08);
    ctx.arc(0, -s * 0.08, s * 0.22, Math.PI, 0);
    ctx.lineTo(s * 0.22, s * 0.14);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s * 0.22, s * 0.45);
    ctx.lineTo(s * 0.04, s * 0.16);
    ctx.lineTo(s * 0.4, s * 0.16);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return;
  }

  if (kind === "roundabout") {
    // Ring plus an exit leaving it, so this never reads as the arrival pin.
    ctx.beginPath();
    ctx.moveTo(-s * 0.02, s * 0.46);
    ctx.lineTo(-s * 0.02, s * 0.06);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-s * 0.02, -s * 0.12, s * 0.18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s * 0.16, -s * 0.12);
    ctx.lineTo(s * 0.3, -s * 0.12);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s * 0.46, -s * 0.12);
    ctx.lineTo(s * 0.26, -s * 0.26);
    ctx.lineTo(s * 0.26, s * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return;
  }

  const deg = TURN_DEG[kind] ?? 0;
  const rad = (deg * Math.PI) / 180;
  // Stem rises from the rider, then the head leaves the elbow at the turn angle.
  const elbowY = deg === 0 ? -s * 0.06 : s * 0.02;
  const reach = deg === 0 ? s * 0.46 : s * 0.42;
  const tipX = Math.sin(rad) * reach;
  const tipY = elbowY - Math.cos(rad) * reach;
  ctx.beginPath();
  ctx.moveTo(0, s * 0.46);
  ctx.lineTo(0, elbowY);
  if (deg !== 0) ctx.lineTo(tipX * 0.55, tipY * 0.55 + elbowY * 0.45);
  ctx.stroke();

  const head = s * 0.2;
  ctx.save();
  ctx.translate(tipX, tipY);
  ctx.rotate(rad);
  ctx.beginPath();
  ctx.moveTo(0, -head * 0.7);
  ctx.lineTo(-head * 0.8, head * 0.6);
  ctx.lineTo(head * 0.8, head * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

/** Metres per degree, near enough at city scale. */
function project(from: { lat: number; lng: number }, to: number[]) {
  const mx = (to[0] - from.lng) * 111320 * Math.cos((from.lat * Math.PI) / 180);
  const my = (to[1] - from.lat) * 110540;
  return { mx, my };
}

function drawRoute(ctx: CanvasRenderingContext2D, frame: MiniNavFrame) {
  const { route, geo } = frame;
  if (!route?.length || !geo) return;

  const h = ((frame.heading ?? 0) * Math.PI) / 180;
  const cos = Math.cos(h);
  const sin = Math.sin(h);
  // Enough road ahead to see the turn coming, without shrinking it to a dot.
  const span = Math.min(900, Math.max(150, (frame.turnMetres ?? 400) * 1.7));
  const scale = FORWARD_PX / span;

  const pts = route.map((c) => {
    const { mx, my } = project(geo, c);
    // Rotating by -heading puts the way ahead at the top of the frame.
    const ex = mx * cos - my * sin;
    const ey = mx * sin + my * cos;
    return { x: MINI_W / 2 + ex * scale, y: ANCHOR_Y - ey * scale, d2: mx * mx + my * my };
  });

  let nearest = 0;
  for (let i = 1; i < pts.length; i++) if (pts[i].d2 < pts[nearest].d2) nearest = i;

  const stroke = (from: number, to: number, colour: string, width: number) => {
    if (to - from < 1) return;
    ctx.beginPath();
    ctx.moveTo(pts[from].x, pts[from].y);
    for (let i = from + 1; i <= to; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  };

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, MINI_W, MINI_H);
  ctx.clip();
  stroke(0, nearest, IN.behind, 6);
  stroke(nearest, pts.length - 1, IN.roadCase, 13);
  stroke(nearest, pts.length - 1, frame.paused ? IN.behind : IN.road, 8);
  ctx.restore();
}

function drawRider(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.translate(MINI_W / 2, ANCHOR_Y);
  ctx.beginPath();
  ctx.moveTo(0, -13);
  ctx.lineTo(10, 11);
  ctx.lineTo(0, 5);
  ctx.lineTo(-10, 11);
  ctx.closePath();
  ctx.fillStyle = IN.rider;
  ctx.strokeStyle = IN.ground;
  ctx.lineWidth = 2.5;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawTurnCard(ctx: CanvasRenderingContext2D, frame: MiniNavFrame) {
  roundRect(ctx, 10, 10, MINI_W - 20, 70, 16);
  ctx.fillStyle = IN.panel;
  ctx.fill();
  ctx.strokeStyle = IN.edge;
  ctx.lineWidth = 1;
  ctx.stroke();

  if (frame.turnArrow) {
    ctx.save();
    ctx.translate(48, 45);
    drawArrow(ctx, frame.turnArrow, 44);
    ctx.restore();
  }

  const left = frame.turnArrow ? 82 : 26;
  if (frame.turnMetres != null) {
    ctx.font = "700 30px system-ui, sans-serif";
    ctx.fillStyle = frame.turnMetres <= 40 ? IN.warn : IN.distance;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(frame.turnMetres <= 40 ? "Ngay bây giờ" : shortMetres(frame.turnMetres), left, 44);
  }
  if (frame.turnLabel) {
    ctx.font = "500 17px system-ui, sans-serif";
    ctx.fillStyle = IN.ink;
    ctx.fillText(ellipsis(ctx, frame.turnLabel, MINI_W - left - 30), left, frame.turnMetres != null ? 68 : 52);
  }
  if (frame.turnMetres == null && !frame.turnLabel) {
    ctx.font = "500 18px system-ui, sans-serif";
    ctx.fillStyle = IN.muted;
    ctx.fillText("Đang bám tuyến đường…", left, 52);
  }
}

function drawFooter(ctx: CanvasRenderingContext2D, frame: MiniNavFrame) {
  roundRect(ctx, 10, MINI_H - 58, MINI_W - 20, 48, 16);
  ctx.fillStyle = IN.panel;
  ctx.fill();
  ctx.strokeStyle = IN.edge;
  ctx.lineWidth = 1;
  ctx.stroke();

  const bits: string[] = [];
  if (frame.remainingMeters != null) bits.push(`còn ${shortMetres(frame.remainingMeters)}`);
  if (frame.remainingSeconds != null) bits.push(shortDuration(frame.remainingSeconds));
  ctx.font = "700 19px system-ui, sans-serif";
  ctx.fillStyle = IN.ink;
  const line = bits.join(" · ") || "Đang tính…";
  ctx.fillText(line, 26, MINI_H - 26);

  if (frame.destination) {
    const used = ctx.measureText(line).width;
    ctx.font = "500 15px system-ui, sans-serif";
    ctx.fillStyle = IN.muted;
    const room = MINI_W - 26 - 26 - used - 16;
    if (room > 60) {
      const label = ellipsis(ctx, frame.destination, room);
      ctx.textAlign = "right";
      ctx.fillText(label, MINI_W - 26, MINI_H - 27);
      ctx.textAlign = "left";
    }
  }
}

export function drawMiniNav(ctx: CanvasRenderingContext2D, frame: MiniNavFrame) {
  ctx.save();
  ctx.fillStyle = IN.ground;
  ctx.fillRect(0, 0, MINI_W, MINI_H);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  drawRoute(ctx, frame);
  drawRider(ctx);
  drawTurnCard(ctx, frame);
  drawFooter(ctx, frame);

  if (frame.paused) {
    roundRect(ctx, MINI_W / 2 - 66, 92, 132, 28, 14);
    ctx.fillStyle = "rgba(251,191,36,0.95)";
    ctx.fill();
    ctx.font = "700 15px system-ui, sans-serif";
    ctx.fillStyle = "#1c1917";
    ctx.textAlign = "center";
    ctx.fillText("ĐANG TẠM DỪNG", MINI_W / 2, 111);
    ctx.textAlign = "left";
  }
  ctx.restore();
}

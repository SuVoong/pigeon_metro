// panel_timeline.js — Bottom timeline showing spawn events.
// Tracks (one per type): trains / pipes / coins / ...
// Each event is a draggable block. Dbl-click empty area → new event.

import * as PM from '../preset_manager.js';
import * as Modal from '../editor_modal.js';

// ── Constants ─────────────────────────────────────────────────────────────────
const HEADER_H = 22;
const TRACK_H  = 22;
const LABEL_W  = 80;

const TRACK_COLORS = {
  trains: '#1A3A8A',
  pipes:  '#888899',
  coins:  '#F5C518',
  default:'#5DCAA5',
};

// ── State ─────────────────────────────────────────────────────────────────────
let _hits = [];
let _drag = null;        // { trackIdx, eventIdx, offsetSec }
let _playhead = 0;       // seconds (for preview)
let _frame = 0;

// ── Public draw ───────────────────────────────────────────────────────────────
export function drawTimeline(ctx, x, y, w, h) {
  _hits = [];
  _frame++;

  // Background
  ctx.fillStyle = '#08080F';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(x, y, w, 1);

  const preset = PM.getActive();
  if (!preset?.spawn) {
    _drawEmpty(ctx, x, y, w, h);
    return;
  }

  const spawn = preset.spawn;
  const cycle = spawn.cycleDuration || 60;

  // Header (time ruler)
  _drawHeader(ctx, x, y, w, cycle);

  // Tracks
  const tracksAreaX = x + LABEL_W;
  const tracksAreaW = w - LABEL_W - 8;
  const tracksTop   = y + HEADER_H;

  if (Modal.isPreviewPlaying()) {
    _playhead = (_playhead + 1 / 60) % cycle;
  }

  for (let i = 0; i < spawn.tracks.length; i++) {
    const t = spawn.tracks[i];
    const ty = tracksTop + i * TRACK_H;
    if (ty + TRACK_H > y + h) break;
    _drawTrack(ctx, x, ty, w, t, i, tracksAreaX, tracksAreaW, cycle);
  }

  // Playhead
  if (cycle > 0) {
    const phx = tracksAreaX + (_playhead / cycle) * tracksAreaW;
    ctx.strokeStyle = '#cc3333';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(phx + 0.5, y + 4);
    ctx.lineTo(phx + 0.5, y + h - 4);
    ctx.stroke();
    ctx.fillStyle = '#cc3333';
    ctx.beginPath();
    ctx.moveTo(phx, y + 2);
    ctx.lineTo(phx - 4, y - 2);
    ctx.lineTo(phx + 4, y - 2);
    ctx.closePath();
    ctx.fill();
  }

  // Right-side label: cycle duration
  ctx.fillStyle = '#666';
  ctx.font = '9px monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`ciclo: ${cycle}s · ${(spawn.randomness * 100).toFixed(0)}% rng`,
               x + w - 8, y + h - 4);
}

function _drawEmpty(ctx, x, y, w, h) {
  ctx.fillStyle = '#555';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Sin eventos de spawn definidos', x + w / 2, y + h / 2);
}

function _drawHeader(ctx, x, y, w, cycle) {
  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(x, y, w, HEADER_H);
  ctx.fillStyle = '#666';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('⏱ TIMELINE', x + 8, y + HEADER_H / 2);

  const tracksAreaX = x + LABEL_W;
  const tracksAreaW = w - LABEL_W - 8;
  // Tick marks every 5 seconds
  const step = cycle <= 30 ? 2 : 5;
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#666';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  for (let s = 0; s <= cycle; s += step) {
    const tx = tracksAreaX + (s / cycle) * tracksAreaW;
    ctx.beginPath();
    ctx.moveTo(tx + 0.5, y + 4);
    ctx.lineTo(tx + 0.5, y + HEADER_H - 2);
    ctx.stroke();
    ctx.fillText(`${s}s`, tx, y + HEADER_H / 2);
  }
}

function _drawTrack(ctx, x, ty, w, track, idx, areaX, areaW, cycle) {
  // Row background (alt rows)
  ctx.fillStyle = idx % 2 === 0 ? '#0a0a14' : '#0d0d1a';
  ctx.fillRect(x, ty, w, TRACK_H);

  // Label
  ctx.fillStyle = TRACK_COLORS[track.type] || TRACK_COLORS.default;
  ctx.fillRect(x + 4, ty + 4, 4, TRACK_H - 8);
  ctx.fillStyle = '#bbb';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(track.type, x + 14, ty + TRACK_H / 2);

  // Events
  const color = TRACK_COLORS[track.type] || TRACK_COLORS.default;
  for (let ei = 0; ei < track.events.length; ei++) {
    const ev = track.events[ei];
    const ex = areaX + (ev.time / cycle) * areaW;
    const ew = 12;
    const ey = ty + 4;
    const eh = TRACK_H - 8;
    ctx.fillStyle = color;
    ctx.fillRect(ex - ew / 2, ey, ew, eh);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(ex - ew / 2 + 0.5, ey + 0.5, ew - 1, eh - 1);
    _hits.push({
      id: 'event', trackIdx: idx, eventIdx: ei,
      x: ex - ew / 2, y: ey, w: ew, h: eh,
    });
  }

  // Track click area for adding events
  _hits.push({ id: 'trackArea', trackIdx: idx,
               x: areaX, y: ty, w: areaW, h: TRACK_H });
}

// ── Input ─────────────────────────────────────────────────────────────────────
export function handleTimelineInput(mx, my, mouseDown, clicked, region) {
  const preset = PM.getActive();
  if (!preset?.spawn) return;
  const cycle = preset.spawn.cycleDuration || 60;
  const areaX = region.x + LABEL_W;
  const areaW = region.w - LABEL_W - 8;

  // Continue drag
  if (mouseDown && _drag) {
    const track = preset.spawn.tracks[_drag.trackIdx];
    if (track) {
      const ev = track.events[_drag.eventIdx];
      if (ev) {
        const t = Math.max(0, Math.min(cycle,
          ((mx - areaX) / areaW) * cycle - _drag.offsetSec));
        ev.time = parseFloat(t.toFixed(2));
        PM.markDirty();
      }
    }
    return;
  }
  if (!mouseDown && _drag) _drag = null;

  if (!clicked) return;

  for (const h of _hits) {
    if (mx < h.x || mx >= h.x + h.w || my < h.y || my >= h.y + h.h) continue;
    if (h.id === 'event') {
      const track = preset.spawn.tracks[h.trackIdx];
      const ev = track?.events[h.eventIdx];
      if (ev) {
        const evX = areaX + (ev.time / cycle) * areaW;
        _drag = {
          trackIdx: h.trackIdx,
          eventIdx: h.eventIdx,
          offsetSec: ((mx - areaX) / areaW) * cycle - ev.time,
        };
      }
      return;
    }
    if (h.id === 'trackArea') {
      // Quick add: click empty area to insert an event at that time.
      const track = preset.spawn.tracks[h.trackIdx];
      if (!track) return;
      const t = ((mx - areaX) / areaW) * cycle;
      const newEv = _newEventForTrack(track.type, t);
      track.events.push(newEv);
      track.events.sort((a, b) => a.time - b.time);
      PM.markDirty();
      Modal.showToast(`+ evento ${track.type} a ${t.toFixed(1)}s`, '#5DCAA5');
      return;
    }
  }
}

function _newEventForTrack(type, time) {
  const t = parseFloat(time.toFixed(2));
  switch (type) {
    case 'trains': return { time: t, variant: 'left',  count: 1 };
    case 'pipes':  return { time: t, height: 'mid' };
    case 'coins':  return { time: t, pattern: 'cluster', count: 5 };
    default:       return { time: t };
  }
}

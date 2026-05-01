// dropdown.js — Reusable dropdown widget for the editor.
// Renders dropdowns directly on the canvas, avoiding z-index issues with HTML selects.

const MAX_VISIBLE_OPTIONS = 8;
const SCROLL_BTN_H = 16;

let _openDropdownId = null;
let _dropdowns = new Map();  // id → { x, y, w, h, options, selectedIndex, onChange }
let _hoveredIndex = -1;
const _scrollOffsets = new Map();   // id → first visible option index (persists across frames)

// ══════════════════════════════════════════
// API
// ══════════════════════════════════════════

// Register a dropdown for this frame. Call during draw before handling input.
// options: [{ value, label, icon?, disabled? }, ...]
// selectedValue: the currently selected option value
export function registerDropdown(id, x, y, w, h, options, selectedValue, onChange) {
  const selectedIndex = Math.max(0, options.findIndex(o => o.value === selectedValue));
  _dropdowns.set(id, { x, y, w, h, options, selectedIndex, onChange });
}

// Handle clicks. Returns true if a dropdown consumed the click.
export function handleDropdownClick(mx, my) {
  if (_openDropdownId) {
    const dd = _dropdowns.get(_openDropdownId);
    if (!dd) { _openDropdownId = null; return false; }

    const optionH = 26;
    const needsScroll = dd.options.length > MAX_VISIBLE_OPTIONS;
    const visibleCount = needsScroll ? MAX_VISIBLE_OPTIONS : dd.options.length;
    const scrollBtnH = needsScroll ? SCROLL_BTN_H : 0;
    const totalH = scrollBtnH * 2 + visibleCount * optionH;
    const listX = dd.x;
    const listY = dd.y + dd.h;
    const listW = dd.w;
    const scrollOffset = _scrollOffsets.get(_openDropdownId) || 0;
    const maxOffset = Math.max(0, dd.options.length - visibleCount);

    // Click anywhere inside the visible list area?
    if (mx >= listX && mx < listX + listW && my >= listY && my < listY + totalH) {
      // Scroll UP button
      if (needsScroll && my < listY + scrollBtnH) {
        if (scrollOffset > 0) _scrollOffsets.set(_openDropdownId, scrollOffset - 1);
        return true;
      }
      // Scroll DOWN button
      const downBtnY = listY + scrollBtnH + visibleCount * optionH;
      if (needsScroll && my >= downBtnY) {
        if (scrollOffset < maxOffset) _scrollOffsets.set(_openDropdownId, scrollOffset + 1);
        return true;
      }
      // Option click (adjusted for scroll offset)
      const optionsAreaY = listY + scrollBtnH;
      const localIdx = Math.floor((my - optionsAreaY) / optionH);
      const idx = localIdx + scrollOffset;
      const opt = dd.options[idx];
      if (opt && !opt.disabled) {
        dd.selectedIndex = idx;
        dd.onChange?.(opt.value);
        _openDropdownId = null;
      }
      return true;
    }

    // Click on trigger? → close
    if (mx >= dd.x && mx < dd.x + dd.w && my >= dd.y && my < dd.y + dd.h) {
      _openDropdownId = null;
      return true;
    }

    // Click outside → close
    _openDropdownId = null;
    return true;
  }

  // No dropdown open: check if any trigger was clicked
  for (const [id, dd] of _dropdowns) {
    if (mx >= dd.x && mx < dd.x + dd.w && my >= dd.y && my < dd.y + dd.h) {
      _openDropdownId = id;
      // Scroll to show selected item when opening
      const visibleCount = Math.min(MAX_VISIBLE_OPTIONS, dd.options.length);
      const selIdx = dd.selectedIndex;
      if (selIdx >= visibleCount) {
        const offset = Math.max(0, selIdx - Math.floor(visibleCount / 2));
        _scrollOffsets.set(id, Math.min(offset, dd.options.length - visibleCount));
      } else {
        _scrollOffsets.set(id, 0);
      }
      return true;
    }
  }

  return false;
}

// Handle hover. Updates the hovered index in the open list.
export function handleDropdownMouseMove(mx, my) {
  if (!_openDropdownId) { _hoveredIndex = -1; return; }
  const dd = _dropdowns.get(_openDropdownId);
  if (!dd) return;

  const optionH = 26;
  const needsScroll = dd.options.length > MAX_VISIBLE_OPTIONS;
  const visibleCount = needsScroll ? MAX_VISIBLE_OPTIONS : dd.options.length;
  const scrollBtnH = needsScroll ? SCROLL_BTN_H : 0;
  const listX = dd.x;
  const optionsY = dd.y + dd.h + scrollBtnH;
  const scrollOffset = _scrollOffsets.get(_openDropdownId) || 0;

  if (mx >= listX && mx < listX + dd.w &&
      my >= optionsY && my < optionsY + visibleCount * optionH) {
    _hoveredIndex = Math.floor((my - optionsY) / optionH) + scrollOffset;
  } else {
    _hoveredIndex = -1;
  }
}

// Is the cursor hovering over any dropdown trigger or open list?
export function isHoveringDropdown(mx, my) {
  for (const [id, dd] of _dropdowns) {
    if (mx >= dd.x && mx < dd.x + dd.w && my >= dd.y && my < dd.y + dd.h) return true;
  }
  if (_openDropdownId) {
    const dd = _dropdowns.get(_openDropdownId);
    if (dd) {
      const needsScroll = dd.options.length > MAX_VISIBLE_OPTIONS;
      const visibleCount = needsScroll ? MAX_VISIBLE_OPTIONS : dd.options.length;
      const scrollBtnH = needsScroll ? SCROLL_BTN_H : 0;
      const totalH = scrollBtnH * 2 + visibleCount * 26;
      if (mx >= dd.x && mx < dd.x + dd.w &&
          my >= dd.y + dd.h && my < dd.y + dd.h + totalH) return true;
    }
  }
  return false;
}

// ══════════════════════════════════════════
// Rendering
// ══════════════════════════════════════════

// Draw the trigger button (always visible)
export function drawDropdownTrigger(ctx, id) {
  const dd = _dropdowns.get(id);
  if (!dd) return;

  const isOpen = _openDropdownId === id;
  const selected = dd.options[dd.selectedIndex] ?? { label: '—' };

  // Button background
  ctx.fillStyle = isOpen ? '#1a1a2e' : '#111';
  _roundRect(ctx, dd.x, dd.y, dd.w, dd.h, 4);
  ctx.fill();

  // Button border
  ctx.strokeStyle = isOpen ? '#f5c518' : '#2a2a3a';
  ctx.lineWidth = 1;
  _roundRect(ctx, dd.x, dd.y, dd.w, dd.h, 4);
  ctx.stroke();

  // Selected text
  ctx.fillStyle = '#ddd';
  ctx.font = '11px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  let textX = dd.x + 10;
  if (selected.icon && selected.icon.trim()) {
    ctx.fillText(selected.icon, textX, dd.y + dd.h / 2);
    textX += 16;
  }

  const maxTextW = dd.w - (textX - dd.x) - 22;
  const label = _truncate(ctx, selected.label, maxTextW);
  ctx.fillText(label, textX, dd.y + dd.h / 2);

  // Caret
  ctx.fillStyle = isOpen ? '#f5c518' : '#666';
  ctx.font = '9px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(isOpen ? '▴' : '▾', dd.x + dd.w - 8, dd.y + dd.h / 2);
}

// Draw the open dropdown list (call at the END of all drawing so it's on top)
export function drawOpenDropdownList(ctx) {
  if (!_openDropdownId) return;
  const dd = _dropdowns.get(_openDropdownId);
  if (!dd) return;

  const optionH = 26;
  const needsScroll = dd.options.length > MAX_VISIBLE_OPTIONS;
  const visibleCount = needsScroll ? MAX_VISIBLE_OPTIONS : dd.options.length;
  const scrollBtnH = needsScroll ? SCROLL_BTN_H : 0;
  const totalH = scrollBtnH * 2 + visibleCount * optionH;
  const listX = dd.x;
  const listY = dd.y + dd.h;
  const listW = dd.w;
  const scrollOffset = _scrollOffsets.get(_openDropdownId) || 0;
  const maxOffset = Math.max(0, dd.options.length - visibleCount);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(listX + 2, listY + 2, listW, totalH);

  // Background
  ctx.fillStyle = '#0d0d18';
  _roundRect(ctx, listX, listY, listW, totalH, 4);
  ctx.fill();

  // Border
  ctx.strokeStyle = '#f5c518';
  ctx.lineWidth = 1;
  _roundRect(ctx, listX, listY, listW, totalH, 4);
  ctx.stroke();

  // ── Scroll UP button ──
  if (needsScroll) {
    const canUp = scrollOffset > 0;
    if (canUp) {
      ctx.fillStyle = 'rgba(245,197,24,0.12)';
      ctx.fillRect(listX + 1, listY + 1, listW - 2, scrollBtnH - 1);
    }
    ctx.fillStyle = canUp ? '#f5c518' : '#333';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('▴', listX + listW / 2, listY + scrollBtnH / 2);
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(listX + 6, listY + scrollBtnH);
    ctx.lineTo(listX + listW - 6, listY + scrollBtnH);
    ctx.stroke();
  }

  // ── Options (clipped to options area) ──
  const optionsY = listY + scrollBtnH;
  ctx.save();
  ctx.beginPath();
  ctx.rect(listX, optionsY, listW, visibleCount * optionH);
  ctx.clip();

  for (let i = 0; i < visibleCount; i++) {
    const optIdx = scrollOffset + i;
    if (optIdx >= dd.options.length) break;
    const opt = dd.options[optIdx];
    const oy = optionsY + i * optionH;
    const isSelected = optIdx === dd.selectedIndex;
    const isHovered  = optIdx === _hoveredIndex;
    const isDisabled = !!opt.disabled;

    // Row background
    if (isDisabled) {
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fillRect(listX, oy, listW, optionH);
    } else if (isHovered) {
      ctx.fillStyle = 'rgba(245,197,24,0.12)';
      ctx.fillRect(listX, oy, listW, optionH);
    } else if (isSelected) {
      ctx.fillStyle = 'rgba(245,197,24,0.06)';
      ctx.fillRect(listX, oy, listW, optionH);
    }

    // Selected indicator bar
    if (isSelected && !isDisabled) {
      ctx.fillStyle = '#f5c518';
      ctx.fillRect(listX, oy, 2, optionH);
    }

    // Option text
    ctx.fillStyle = isDisabled ? '#555'
                  : isHovered  ? '#f5c518'
                  : isSelected ? '#f5c518'
                  : '#ccc';
    ctx.font = isDisabled ? 'bold 9px monospace' : '11px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    let tx = listX + (isDisabled ? 8 : 12);
    if (opt.icon && opt.icon.trim() && !isDisabled) {
      ctx.fillText(opt.icon, tx, oy + optionH / 2);
      tx += 16;
    }
    const labelMaxW = listW - (tx - listX) - 8;
    ctx.fillText(_truncate(ctx, opt.label, labelMaxW), tx, oy + optionH / 2);

    // Separator
    if (i < visibleCount - 1) {
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(listX + 6, oy + optionH);
      ctx.lineTo(listX + listW - 6, oy + optionH);
      ctx.stroke();
    }
  }

  ctx.restore();

  // ── Scroll DOWN button ──
  if (needsScroll) {
    const canDown = scrollOffset < maxOffset;
    const btnY = optionsY + visibleCount * optionH;
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(listX + 6, btnY);
    ctx.lineTo(listX + listW - 6, btnY);
    ctx.stroke();
    if (canDown) {
      ctx.fillStyle = 'rgba(245,197,24,0.12)';
      ctx.fillRect(listX + 1, btnY, listW - 2, scrollBtnH - 1);
    }
    ctx.fillStyle = canDown ? '#f5c518' : '#333';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('▾', listX + listW / 2, btnY + scrollBtnH / 2);
  }
}

// Clear dropdown registry at the start of each frame (scroll offsets are preserved)
export function clearDropdownRegistry() {
  _dropdowns.clear();
}

// Close all dropdowns
export function closeAllDropdowns() {
  _openDropdownId = null;
}

// ══════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════

function _truncate(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (ctx.measureText(t + '…').width > maxW && t.length > 0) {
    t = t.slice(0, -1);
  }
  return t + '…';
}

function _roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}

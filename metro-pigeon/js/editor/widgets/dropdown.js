// dropdown.js — Reusable dropdown widget for the editor.
// Renders dropdowns directly on the canvas, avoiding z-index issues with HTML selects.

let _openDropdownId = null;
let _dropdowns = new Map();  // id → { x, y, w, h, options, selectedIndex, onChange }
let _hoveredIndex = -1;

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
    if (!dd) {
      _openDropdownId = null;
      return false;
    }

    const optionH = 26;
    const listH = dd.options.length * optionH;
    const listX = dd.x;
    const listY = dd.y + dd.h;
    const listW = dd.w;

    // Click in the open list?
    if (mx >= listX && mx < listX + listW &&
        my >= listY && my < listY + listH) {
      const idx = Math.floor((my - listY) / optionH);
      const opt = dd.options[idx];
      if (opt && !opt.disabled) {
        dd.selectedIndex = idx;
        dd.onChange?.(opt.value);
        _openDropdownId = null;
        return true;
      }
      return true;
    }

    // Click on trigger? Toggle
    if (mx >= dd.x && mx < dd.x + dd.w &&
        my >= dd.y && my < dd.y + dd.h) {
      _openDropdownId = null;
      return true;
    }

    // Click outside → close
    _openDropdownId = null;
    return true;
  }

  // No dropdown open: check if any trigger was clicked
  for (const [id, dd] of _dropdowns) {
    if (mx >= dd.x && mx < dd.x + dd.w &&
        my >= dd.y && my < dd.y + dd.h) {
      _openDropdownId = id;
      return true;
    }
  }

  return false;
}

// Handle hover. Updates the hovered index in the open list.
export function handleDropdownMouseMove(mx, my) {
  if (!_openDropdownId) {
    _hoveredIndex = -1;
    return;
  }
  const dd = _dropdowns.get(_openDropdownId);
  if (!dd) return;

  const optionH = 26;
  const listX = dd.x;
  const listY = dd.y + dd.h;
  const listW = dd.w;

  if (mx >= listX && mx < listX + listW &&
      my >= listY && my < listY + dd.options.length * optionH) {
    _hoveredIndex = Math.floor((my - listY) / optionH);
  } else {
    _hoveredIndex = -1;
  }
}

// Is the cursor hovering over a dropdown?
export function isHoveringDropdown(mx, my) {
  // Check all triggers
  for (const [id, dd] of _dropdowns) {
    if (mx >= dd.x && mx < dd.x + dd.w && my >= dd.y && my < dd.y + dd.h) return true;
  }
  // Check open list
  if (_openDropdownId) {
    const dd = _dropdowns.get(_openDropdownId);
    if (dd) {
      const optionH = 26;
      if (mx >= dd.x && mx < dd.x + dd.w &&
          my >= dd.y + dd.h && my < dd.y + dd.h + dd.options.length * optionH) return true;
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
  if (selected.icon) {
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

// Draw the open dropdown list (call at the END of all drawing)
export function drawOpenDropdownList(ctx) {
  if (!_openDropdownId) return;
  const dd = _dropdowns.get(_openDropdownId);
  if (!dd) return;

  const optionH = 26;
  const listH = dd.options.length * optionH;
  const listX = dd.x;
  const listY = dd.y + dd.h;
  const listW = dd.w;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(listX + 2, listY + 2, listW, listH);

  // Background
  ctx.fillStyle = '#0d0d18';
  _roundRect(ctx, listX, listY, listW, listH, 4);
  ctx.fill();

  // Border
  ctx.strokeStyle = '#f5c518';
  ctx.lineWidth = 1;
  _roundRect(ctx, listX, listY, listW, listH, 4);
  ctx.stroke();

  // Options
  dd.options.forEach((opt, i) => {
    const oy = listY + i * optionH;
    const isSelected = i === dd.selectedIndex;
    const isHovered = i === _hoveredIndex;
    const isDisabled = !!opt.disabled;

    // Row background
    if (isHovered && !isDisabled) {
      ctx.fillStyle = 'rgba(245,197,24,0.12)';
      ctx.fillRect(listX, oy, listW, optionH);
    } else if (isSelected) {
      ctx.fillStyle = 'rgba(245,197,24,0.06)';
      ctx.fillRect(listX, oy, listW, optionH);
    }

    // Selected indicator
    if (isSelected) {
      ctx.fillStyle = '#f5c518';
      ctx.fillRect(listX, oy, 2, optionH);
    }

    // Option text
    ctx.fillStyle = isDisabled ? '#444'
                  : isHovered ? '#f5c518'
                  : isSelected ? '#f5c518'
                  : '#ccc';
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    let tx = listX + 12;
    if (opt.icon) {
      ctx.fillText(opt.icon, tx, oy + optionH / 2);
      tx += 16;
    }
    const labelMaxW = listW - (tx - listX) - 12;
    ctx.fillText(_truncate(ctx, opt.label, labelMaxW), tx, oy + optionH / 2);

    // Separator
    if (i < dd.options.length - 1) {
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(listX + 6, oy + optionH);
      ctx.lineTo(listX + listW - 6, oy + optionH);
      ctx.stroke();
    }
  });
}

// Clear registry at the start of each frame
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

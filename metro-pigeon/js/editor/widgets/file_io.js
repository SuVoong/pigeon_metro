// file_io.js — Import / export presets to/from JSON files.
// Uses browser download trick + hidden file input for picking.

import * as PM from '../preset_manager.js';

export function exportPresetToFile(preset) {
  if (!preset) return false;
  try {
    const json = JSON.stringify(preset, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${preset.id || 'preset'}.preset.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch (e) {
    console.warn('exportPresetToFile failed', e);
    // Fallback: copy to clipboard
    if (navigator.clipboard) {
      navigator.clipboard.writeText(JSON.stringify(preset, null, 2)).catch(() => {});
    }
    return false;
  }
}

export function exportAllPresetsToFile() {
  try {
    const json = PM.exportAll();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vp_presets_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch (e) {
    console.warn('exportAllPresetsToFile failed', e);
    return false;
  }
}

/**
 * Opens a file picker. Calls callback({ ok, preset, error }).
 */
export function importPresetFromFile(callback) {
  try {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) { callback({ ok: false, error: 'sin archivo' }); return; }
      const reader = new FileReader();
      reader.onload = () => {
        const result = PM.importPreset(reader.result);
        callback(result);
        document.body.removeChild(input);
      };
      reader.onerror = () => {
        callback({ ok: false, error: 'lectura fallida' });
        document.body.removeChild(input);
      };
      reader.readAsText(file);
    });
    document.body.appendChild(input);
    input.click();
  } catch (e) {
    callback({ ok: false, error: e.message });
  }
}

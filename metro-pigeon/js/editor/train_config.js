// train_config.js — Reactive TRAIN_CFG object read by metro_base_render.js

import { loadConfigs } from './config_store.js';

export const TRAIN_CFG = loadConfigs().train;

/** Re-reads persisted config and updates TRAIN_CFG in place.
 *  Call after saveTrainConfig() so the renderer picks up the new values. */
export function refreshTrainConfig() {
  const fresh = loadConfigs().train;
  Object.assign(TRAIN_CFG, fresh);
}

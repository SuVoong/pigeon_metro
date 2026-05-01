// env_config.js — Reactive ENV_CFG object read by metro_base_render.js

import { loadConfigs } from './config_store.js';

export const ENV_CFG = loadConfigs().env;

/** Re-reads persisted config and updates ENV_CFG in place.
 *  Call after saveEnvConfig() so the renderer picks up the new values. */
export function refreshEnvConfig() {
  const fresh = loadConfigs().env;
  Object.assign(ENV_CFG, fresh);
}

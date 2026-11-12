import { migrateHistory } from './history-migrate.js';

export function backupDataFromPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) {
    throw new Error('This file is not a valid Prayer Times backup.');
  }
  if (!Number.isInteger(payload.version) || payload.version < 1 || payload.version > 2) {
    throw new Error('This backup format is not supported by this version.');
  }
  return payload.data;
}

/** Merge prayer records without duplicating dates or overwriting conflicting local values. */
export function mergeBackupHistory(localHistory, importedHistory) {
  const merged = migrateHistory(localHistory);
  const conflicts = [];
  for (const [day, incoming] of Object.entries(migrateHistory(importedHistory))) {
    const current = merged[day] || { fard: {}, voluntary: {} };
    for (const layer of ['fard', 'voluntary', 'sunnah', 'nafl']) {
      const existingMap = current[layer] && typeof current[layer] === 'object' ? current[layer] : (current[layer] = {});
      for (const [key, value] of Object.entries(incoming[layer] || {})) {
        if (Object.hasOwn(existingMap, key) && existingMap[key] !== value) conflicts.push(`${day} · ${layer}.${key}`);
        else if (!Object.hasOwn(existingMap, key)) existingMap[key] = value;
      }
    }
    for (const field of ['at', 'atEpoch', 'locked']) {
      current[field] ||= {};
      for (const [key, value] of Object.entries(incoming[field] || {})) {
        if (Object.hasOwn(current[field], key) && JSON.stringify(current[field][key]) !== JSON.stringify(value)) conflicts.push(`${day} · ${field}.${key}`);
        else if (!Object.hasOwn(current[field], key)) current[field][key] = value;
      }
    }
    merged[day] = current;
  }
  return { history: merged, conflicts };
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Merge settings by filling local defaults; custom local settings win conflicts. */
export function mergeBackupState(localState, importedState, defaults, providedKeys = Object.keys(importedState || {})) {
  const merged = { ...localState };
  const historyResult = mergeBackupHistory(localState.history, importedState.history);
  merged.history = historyResult.history;
  const conflicts = [...historyResult.conflicts];
  const mapSettings = new Set(['sections', 'cards', 'reminders', 'preReminders', 'adjustments']);
  for (const key of Object.keys(defaults || {})) {
    if (key === 'history' || !providedKeys.includes(key) || !Object.hasOwn(importedState || {}, key)) continue;
    const localValue = localState?.[key];
    const importedValue = importedState[key];
    if (same(localValue, importedValue)) continue;
    if (key === 'reminderSent' || key === 'transitionSent') {
      const combined = { ...(importedValue || {}), ...(localValue || {}) };
      for (const [marker, stamp] of Object.entries(importedValue || {})) {
        if (Number.isFinite(Number(stamp)) && Number.isFinite(Number(localValue?.[marker]))) combined[marker] = Math.max(Number(stamp), Number(localValue[marker]));
      }
      merged[key] = combined;
      continue;
    }
    if (mapSettings.has(key) && localValue && importedValue && typeof localValue === 'object' && typeof importedValue === 'object') {
      const combined = { ...localValue };
      for (const [subkey, incoming] of Object.entries(importedValue)) {
        if (!Object.hasOwn(localValue, subkey) || same(localValue[subkey], defaults[key]?.[subkey])) combined[subkey] = incoming;
        else if (!same(localValue[subkey], incoming)) conflicts.push(`settings.${key}.${subkey}`);
      }
      merged[key] = combined;
      continue;
    }
    if (!Object.hasOwn(localState || {}, key) || same(localValue, defaults[key])) merged[key] = importedValue;
    else conflicts.push(`settings.${key}`);
  }
  return { data: merged, conflicts };
}

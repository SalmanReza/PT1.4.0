/* Prayer completion recording windows.
   These windows govern when the user may enter a completion they actually performed.
   They do not define religious validity or extend a prayer's actual worship opportunity. */
const ms = value => value instanceof Date ? value.getTime() : Number(value);

/**
 * Fard: own Fard period plus the following Fard period; closes at the start of
 * the second following Fard period. Voluntary: closes at the start of the
 * second Fard period beginning after the voluntary event starts.
 * `fardEvents` must include enough neighbouring days and be chronological.
 */
export function recordingLockAt(event, fardEvents = []) {
  const ordered = [...(fardEvents || [])]
    .map(item => ({ ...item, at: ms(item.start) }))
    .filter(item => Number.isFinite(item.at))
    .sort((a, b) => a.at - b.at);
  const start = ms(event?.start);
  if (!Number.isFinite(start)) return null;
  let index = -1;
  if (event.kind === 'fard') {
    index = ordered.findIndex(item => item.key === event.key && item.at === start &&
      (!event.date || !item.date || String(item.date) === String(event.date)));
    if (index < 0) index = ordered.findIndex(item => item.key === event.key && item.at === start);
    if (index < 0) return null;
    return ordered[index + 2] ? { at: ordered[index + 2].at, by: ordered[index + 2].key } : null;
  }
  const following = ordered.filter(item => item.at > start);
  const lock = following[1];
  return lock ? { at: lock.at, by: lock.key } : null;
}

/** Recording is available from the event's eligible start until, but not at, its lock instant. */
export function canRecordEvent(event, fardEvents, now) {
  const at = ms(now);
  const start = ms(event?.start);
  const lock = recordingLockAt(event, fardEvents);
  return Number.isFinite(at) && Number.isFinite(start) && !!lock && at >= start && at < lock.at;
}

/** Actual eligibility is deliberately checked separately by the caller. */
export function recordingWindow(event, fardEvents) {
  const lock = recordingLockAt(event, fardEvents);
  return lock ? { start: ms(event.start), end: lock.at, lockedBy: lock.by } : null;
}

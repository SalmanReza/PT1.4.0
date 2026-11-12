const ms = value => value instanceof Date ? value.getTime() : Number(value);

/** Collect only transitions inside the short resume grace window. */
export function dueTransitions(events = [], now = Date.now(), graceMs = 120000) {
  const at = ms(now);
  const due = [];
  for (const event of events || []) {
    for (const [type, value] of [['start', event.start], ['end', event.end]]) {
      const instant = ms(value);
      if (!Number.isFinite(instant) || instant > at || at - instant > graceMs) continue;
      due.push({ type, key: event.key, kind: event.kind, at: instant, date: event.date });
    }
  }
  return due.sort((a, b) => a.at - b.at || a.type.localeCompare(b.type) || a.key.localeCompare(b.key));
}

/** Combine every transition at the same instant into one notification group. */
export function groupTransitions(transitions = []) {
  const groups = new Map();
  for (const item of transitions || []) {
    const key = String(ms(item.at));
    if (!groups.has(key)) groups.set(key, { at: ms(item.at), starts: [], ends: [] });
    const target = item.type === 'start' ? groups.get(key).starts : groups.get(key).ends;
    if (!target.some(event => event.kind === item.kind && event.key === item.key && String(event.date) === String(item.date))) target.push(item);
  }
  return [...groups.values()].sort((a, b) => a.at - b.at);
}

export function transitionId(group) {
  const names = [...group.starts.map(item => `s:${item.kind}:${item.key}:${item.date}`), ...group.ends.map(item => `e:${item.kind}:${item.key}:${item.date}`)].sort();
  return `${group.at}|${names.join('|')}`;
}

export function transitionItemId(type, event) {
  const date = event.date instanceof Date
    ? `${event.date.getFullYear()}-${String(event.date.getMonth() + 1).padStart(2, '0')}-${String(event.date.getDate()).padStart(2, '0')}`
    : String(event.date || '');
  return `${type}|${event.kind}|${event.key}|${date}`;
}

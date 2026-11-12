/* Deliberate, user-confirmed completion recovery. This never infers performance. */
const ms = value => value instanceof Date ? value.getTime() : Number(value);

export function recoveryPrerequisites(fardEvents, isComplete, now = Date.now()) {
  const at = ms(now);
  const preceding = [...(fardEvents || [])]
    .filter(event => ms(event.start) < at)
    .sort((a, b) => ms(a.start) - ms(b.start))
    .slice(-2);
  return preceding.length === 2 && preceding.every(event => !!isComplete(event));
}

export function recoveryCandidates(fardEvents, isComplete, isLocked, now = Date.now()) {
  const at = ms(now);
  return [...(fardEvents || [])]
    .filter(event => ms(event.start) < at && !isComplete(event) && !!isLocked(event))
    .sort((a, b) => ms(b.start) - ms(a.start));
}

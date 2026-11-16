// Formatting preserves the signer's wording; live sharing is controlled separately.
export function appendWord(draft, word) {
  return [draft.trim(), word.trim()].filter(Boolean).join(' ').slice(0, 1000);
}
export function readableCaption(draft) {
  const text = draft.trim().replace(/\s+/g, ' ');
  if (!text) return '';
  return text[0].toUpperCase() + text.slice(1);
}
export function displayScore(value) {
  return Number.isFinite(value) ? `${Math.round(Math.max(0, Math.min(1, value)) * 100)}% model score` : 'No score';
}
export function validateStoredGestures(raw) {
  if (!Array.isArray(raw) || raw.length > 8) throw new Error('Invalid gesture library');
  return raw.map(g => {
    if (!g || typeof g.id !== 'string' || typeof g.name !== 'string' || !g.name.trim() || g.name.length > 160 || !Array.isArray(g.takes) || g.takes.length > 5) throw new Error('Invalid saved gesture');
    const takes = g.takes.map(t => {
      if (!Array.isArray(t) || t.length !== 128 || !t.every(Number.isFinite) || t.some(v => Math.abs(v) > 2)) throw new Error('Invalid gesture recording');
      return Float32Array.from(t);
    });
    return { id: g.id, name: g.name, takes };
  });
}

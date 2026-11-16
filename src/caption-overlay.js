export const DEFAULT_CAPTION_STYLE = { font: 'sans', size: 30, color: '#ffffff', design: 'box', position: 'bottom', align: 'center', bold: true };
export function captionStyle(raw = {}) {
  const choose = (key, choices) => choices.includes(raw[key]) ? raw[key] : DEFAULT_CAPTION_STYLE[key];
  return {
    font: choose('font', ['sans', 'serif', 'mono']),
    size: Number.isFinite(Number(raw.size)) ? Math.max(18, Math.min(56, Number(raw.size))) : 30,
    color: /^#[0-9a-f]{6}$/i.test(raw.color ?? '') ? raw.color : '#ffffff',
    design: choose('design', ['box', 'outline', 'plain']),
    position: choose('position', ['bottom', 'middle', 'top']),
    align: choose('align', ['center', 'left']),
    bold: typeof raw.bold === 'boolean' ? raw.bold : true,
  };
}
export function removeLastWord(text) {
  const trimmed = text.trimEnd(); const match = /\S+$/.exec(trimmed);
  return match ? { text: trimmed.slice(0, match.index).trimEnd(), word: match[0] } : { text: '', word: '' };
}
export function finishSentence(text) {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  return trimmed && trimmed.length < 1000 && !/[.!?…]$/.test(trimmed) ? trimmed + '.' : trimmed;
}

// Display lifetime is independent of the editable message and saved history.
export const CAPTION_TIMES = { word: 6000, sentence: 15000, preview: 3500, review: 10000, sent: 10000, singleDraft: 15000 };
export const wordCount = text => text.trim().split(/\s+/).filter(Boolean).length;
export class CaptionDisplay {
  constructor(now = () => Date.now()) { this.now = now; this.clear(); }
  clear() { this.draft = null; this.preview = null; this.sent = null; this.candidate = null; }
  setDraft(text, at = this.now()) {
    this.sent = null;
    this.draft = text.trim() ? { text: text.trim(), until: at + (wordCount(text) > 1 ? CAPTION_TIMES.sentence : CAPTION_TIMES.word) } : null;
  }
  beginSign() {
    this.preview = null; this.sent = null; this.candidate = null;
  }
  setPreview(text, review = false) {
    this.sent = null;
    this.preview = text.trim() ? { text: text.trim(), review, until: this.now() + (review ? CAPTION_TIMES.review : CAPTION_TIMES.preview) } : null;
  }
  /** Require agreement over time; weak windows never replace a word with filler. */
  considerPreview(text) {
    const now = this.now();
    if (!text) { this.candidate = null; return; }
    if (this.candidate?.text !== text || now - this.candidate.last > 1500) this.candidate = { text, since: now, last: now, count: 0 };
    this.candidate.last = now;
    this.candidate.count++;
    if (this.candidate.count >= 2 && now - this.candidate.since >= 250) this.setPreview(text);
  }
  clearPreview() { this.preview = null; this.candidate = null; }
  showSent(text, at = this.now()) {
    this.clear();
    this.sent = { text, until: at + CAPTION_TIMES.sent };
  }
  clearLive() { this.draft = null; this.clearPreview(); }
  view() {
    const now = this.now(), active = value => value && value.until > now ? value.text : '';
    const preview = active(this.preview), draft = active(this.draft), sent = active(this.sent);
    return { preview, text: draft || sent, kind: draft ? 'draft' : sent ? 'sent' : preview ? 'preview' : 'empty' };
  }
}

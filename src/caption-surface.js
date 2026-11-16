/** Spoken/camera content only. Suggestions and engine state belong in controls.
 * Never strip punctuation or words from text the person actually chose.
 */
export function captionContent(display,editingText=null){
  return editingText===null ? String(display?.text||'') : String(editingText);
}

import {it,expect} from 'vitest';
import {captionContent} from './caption-surface.js';
it('never sends unconfirmed suggestions or engine messages to the caption surface',()=>{
  expect(captionContent({text:'',preview:'Good morning',status:'Detected'})).toBe('');
  expect(captionContent({text:'Hello',preview:'blue',status:'Reading sign…'})).toBe('Hello');
});
it('preserves exact chosen wording and punctuation without generated prefixes or suffixes',()=>{
  expect(captionContent({text:'Good morning'})).toBe('Good morning');
  expect(captionContent({text:'Detected… is the word I typed.'})).toBe('Detected… is the word I typed.');
  expect(captionContent({text:'Old'},'My edited answer.')).toBe('My edited answer.');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('each UI control ID is unique so the settings and camera cannot bind the wrong button', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  const repeated = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepEqual(repeated, []);
});
test('all direct browser control bindings have a corresponding element after the layout redesign', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
  const controls = new Set([...main.matchAll(/\$\('([^']+)'\)/g)].map(match => match[1]));
  assert.deepEqual([...controls].filter(id => !ids.has(id)), []);
});

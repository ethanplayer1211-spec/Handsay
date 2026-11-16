import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const commit = 'ffc0578e68449676b6e9545da82092679914e8c8';
const files = [
  {
    path: 'public/models/model.onnx',
    url: `https://raw.githubusercontent.com/shashank11yadav/GestureSign/${commit}/web/public/models/model.onnx`,
    bytes: 5622355, algorithm: 'git-blob', hash: '4cdac8c0feabfebe651f5d59dfd5ea65a9ea9934',
  },
  {
    path: 'public/vendor/mediapipe/models/holistic_landmarker.task',
    url: 'https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/1/holistic_landmarker.task',
    bytes: 13683609, algorithm: 'sha256', hash: 'e2dab61191e2dcd0a15f943d8e3ed1dce13c82dfa597b9dd39f562975a50c3f8',
  },
  {
    path: 'shared/fixtures/features.json',
    url: `https://raw.githubusercontent.com/shashank11yadav/GestureSign/${commit}/shared/fixtures/features.json`,
    bytes: 1251570, algorithm: 'git-blob', hash: '7cccd237b3a7159f3835c8f79c0611c341130afb',
  },
];
function valid(bytes, spec) {
  if (bytes.length !== spec.bytes) return false;
  const hash = spec.algorithm === 'git-blob'
    ? createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')
    : createHash('sha256').update(bytes).digest('hex');
  return hash === spec.hash;
}
for (const spec of files) {
  const dest = resolve(root, spec.path);
  let cached;
  try { cached = await readFile(dest); } catch {}
  if (cached && valid(cached, spec)) { console.log(`Verified ${spec.path}`); continue; }
  const response = await fetch(spec.url);
  if (!response.ok) throw new Error(`Download failed: ${spec.path} HTTP ${response.status}`);
  const chunks = []; let length = 0;
  for await (const chunk of response.body) {
    length += chunk.length;
    if (length > spec.bytes) throw new Error(`Unexpected file size: ${spec.path}`);
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  if (!valid(bytes, spec)) throw new Error(`Integrity check failed: ${spec.path}`);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, bytes);
  console.log(`Downloaded and verified ${spec.path}`);
}
const copies = [
  ['@mediapipe/tasks-vision/wasm/vision_wasm_module_internal.js', 'mediapipe/wasm'],
  ['@mediapipe/tasks-vision/wasm/vision_wasm_module_internal.wasm', 'mediapipe/wasm'],
  ['onnxruntime-web/dist/ort-wasm-simd-threaded.mjs', 'ort'],
  ['onnxruntime-web/dist/ort-wasm-simd-threaded.wasm', 'ort'],
];
for (const [src, folder] of copies) {
  const dest = resolve(root, 'public/vendor', folder, basename(src));
  await mkdir(dirname(dest), { recursive: true });
  await copyFile(resolve(root, 'node_modules', src), dest);
}
console.log('Runtime assets ready. All inference files will be served locally.');

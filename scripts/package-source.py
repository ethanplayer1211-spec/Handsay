"""Package only reviewed project inputs, excluding credentials and generated runtimes."""
from pathlib import Path
from hashlib import sha256
import zipfile

root = Path(__file__).resolve().parent.parent
files = [
    'package.json', 'package-lock.json', 'index.html', 'vite.config.js', 'server.mjs',
    'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'Dockerfile', 'compose.yaml',
    'Caddyfile', '.dockerignore', '.gitignore',
    'Start-Handsay.cmd',
]
folders = ['src', 'scripts', 'test', 'docs', 'diagnostics', 'third-party', 'shared', 'public/models', 'public/replay', 'public/licenses']
paths = [root / name for name in files] + [root / 'public/mark.svg', root / 'public/GestureSign-LICENSE.txt']
for folder in folders:
    paths.extend(p for p in (root / folder).rglob('*') if p.is_file() and '__pycache__' not in p.parts)
out = root / 'release/handsay-source-v0.1.zip'
out.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=7) as archive:
    for path in sorted(set(paths)):
        archive.write(path, Path('handsay') / path.relative_to(root))
digest = sha256(out.read_bytes()).hexdigest()
(out.parent / 'handsay-source-v0.1.sha256').write_text(f'{digest}  {out.name}\n')
print(f'Packaged {len(set(paths))} files: {out} ({out.stat().st_size:,} bytes)')
print(f'SHA256 {digest}')

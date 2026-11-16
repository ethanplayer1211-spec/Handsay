import { defineConfig } from 'vite';
export default defineConfig({
  server: { proxy: { '/api': 'http://127.0.0.1:5418' } },
  worker: { format: 'es' },
  build: { target: 'es2022' },
  test: { include: ['src/**/*.test.ts'], pool: 'forks', maxWorkers: 2 },
});

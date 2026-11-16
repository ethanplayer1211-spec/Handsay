import { defineConfig } from 'vitest/config';
export default defineConfig({test:{include:['scripts/simulated-interview.test.ts'],environment:'node'}});

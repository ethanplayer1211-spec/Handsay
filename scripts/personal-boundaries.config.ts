import {defineConfig} from 'vitest/config';
export default defineConfig({test:{include:['diagnostics/personal-boundaries.test.ts'],environment:'node'}});

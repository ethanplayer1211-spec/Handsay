import {defineConfig} from 'vitest/config';
export default defineConfig({test:{include:['diagnostics/motion-recording.test.ts'],pool:'forks',maxWorkers:1}});

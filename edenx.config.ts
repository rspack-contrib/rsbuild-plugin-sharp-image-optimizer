import { moduleTools, defineConfig } from '@edenx/module-tools';

export default defineConfig({
  plugins: [moduleTools()],
  buildPreset: 'npm-library',
});

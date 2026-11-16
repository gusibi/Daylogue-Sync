import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit/D1 tests own an isolated Miniflare instance. Starting SvelteKit's dev
// platform proxy here leaves another workerd process alive after teardown.
export default defineConfig({
  resolve: { alias: { $lib: fileURLToPath(new URL('./src/lib', import.meta.url)) } },
  test: { include: ['src/**/*.{test,spec}.{js,ts}'] }
});

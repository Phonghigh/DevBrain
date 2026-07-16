import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts', 'src/**/*.spec.ts'],
  },
  plugins: [
    // Vitest transpiles TS with esbuild, which strips types but cannot emit decorator
    // metadata — so Nest sees a constructor with no declared dependencies and silently
    // injects nothing (`this.prisma === undefined`, no error). SWC does emit it, so the
    // DI container resolves the same way it does under `nest build`.
    swc.vite({
      jsc: {
        target: 'es2022',
        parser: { syntax: 'typescript', decorators: true },
        // The two settings that matter: the legacy (TS `experimentalDecorators`) form,
        // and emitting the parameter types Nest reads back at runtime.
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
      module: { type: 'es6' },
    }),
  ],
});

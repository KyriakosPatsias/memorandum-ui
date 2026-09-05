import * as esbuild from 'esbuild';

async function buildElectron() {
  await esbuild.build({
    entryPoints: ['electron/main.ts', 'electron/preload.ts'],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    outExtension: { '.js': '.cjs' },
    outdir: 'dist-electron',
    external: ['electron'],
    sourcemap: true,
  });
  console.log('✓ Electron build completed (.cjs)');
}

buildElectron().catch((err) => {
  console.error(err);
  process.exit(1);
});

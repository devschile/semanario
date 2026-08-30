import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('el build copia los assets visuales dentro de la edición publicada', async () => {
  const tmp = await mkdtemp(path.join('/tmp', 'semanario-build-'));
  const fecha = '2099-01-02';
  const edicion = path.join(tmp, 'ediciones', fecha);
  const contenidoAsset = 'fixture visual';

  try {
    await mkdir(path.join(edicion, 'assets'), { recursive: true });
    await writeFile(path.join(tmp, 'index.html'), '<main><!-- build:ediciones --><!-- /build:ediciones --></main>');
    await writeFile(
      path.join(edicion, 'newsletter.html'),
      '<title>Semanario devsChile — edición del 28 dic 2098 – 2 ene 2099</title>'
        + '<div style="display:none">📰 Semanario devsChile — prueba</div>',
    );
    await writeFile(path.join(edicion, 'assets', 'screenshot-comunidad.png'), contenidoAsset);

    execFileSync('node', ['scripts/build.mjs'], {
      cwd: raiz,
      env: { ...process.env, SEMANARIO_ROOT: tmp },
      stdio: 'pipe',
    });

    assert.equal(
      await readFile(path.join(tmp, 'dist', 'newsletter', fecha, 'assets', 'screenshot-comunidad.png'), 'utf8'),
      contenidoAsset,
    );
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

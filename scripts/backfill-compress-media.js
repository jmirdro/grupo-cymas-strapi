'use strict';

// Script de un solo uso: comprime los archivos de vídeo/imagen YA SUBIDOS
// (los nuevos ya se comprimen solos gracias a src/index.js). Corre contra
// el disco local y la base de datos de Strapi, sin pasar por red — se
// ejecuta en el propio servidor donde viven los archivos.
//
// Uso: node scripts/backfill-compress-media.js [--dry-run]

const path = require('node:path');
const fs = require('node:fs/promises');
const sharp = require('sharp');
const { compileStrapi, createStrapi } = require('@strapi/strapi');
const { isVideo, buildFfmpegArgs, runFfmpeg } = require('../src/utils/compress-video');

const IMAGE_QUALITY = 80; // mismo valor que sizeOptimization en el admin
const OPTIMIZABLE_IMAGE_FORMATS = new Set(['jpeg', 'webp']);

function isOptimizableImage(mime) {
  if (typeof mime !== 'string' || !mime.startsWith('image/')) return false;
  const format = mime.split('/')[1];
  return OPTIMIZABLE_IMAGE_FORMATS.has(format);
}

// El temporal tiene que vivir en el MISMO directorio que el archivo final:
// si va a os.tmpdir() (normalmente un disco distinto al volumen montado),
// el fs.rename() de más abajo falla con EXDEV y el archivo nunca se
// reemplaza, aunque la compresión en sí haya ido bien.
function tmpPathFor(filePath) {
  return path.join(path.dirname(filePath), `.tmp-backfill-${path.basename(filePath)}`);
}

async function compressVideoFile(filePath) {
  const tmpPath = tmpPathFor(filePath);
  await runFfmpeg(buildFfmpegArgs(filePath, tmpPath));
  const stat = await fs.stat(tmpPath);
  return { tmpPath, newBytes: stat.size };
}

async function compressImageFile(filePath, mime) {
  const format = mime.split('/')[1];
  const tmpPath = tmpPathFor(filePath);
  await sharp(filePath)[format]({ quality: IMAGE_QUALITY }).toFile(tmpPath);
  const stat = await fs.stat(tmpPath);
  return { tmpPath, newBytes: stat.size };
}

async function run() {
  const dryRun = process.argv.includes('--dry-run');
  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();
  app.log.level = 'error';

  const uploadsDir = path.join(app.dirs.static.public, 'uploads');
  const files = await app.db.query('plugin::upload.file').findMany({
    where: { provider: 'local' },
  });

  let savedBytes = 0;
  let touched = 0;
  let skipped = 0;

  for (const file of files) {
    const isImg = isOptimizableImage(file.mime);
    const isVid = isVideo(file.mime);
    if (!isImg && !isVid) {
      skipped += 1;
      continue;
    }

    const filePath = path.join(uploadsDir, `${file.hash}${file.ext}`);
    try {
      await fs.access(filePath);
    } catch {
      app.log.warn(`Archivo en BD sin fichero en disco, se omite: ${filePath}`);
      skipped += 1;
      continue;
    }

    const originalBytes = file.size * 1024;
    try {
      const { tmpPath, newBytes } = isVid
        ? await compressVideoFile(filePath)
        : await compressImageFile(filePath, file.mime);

      if (newBytes >= originalBytes) {
        await fs.unlink(tmpPath).catch(() => {});
        skipped += 1;
        continue;
      }

      if (dryRun) {
        await fs.unlink(tmpPath).catch(() => {});
        savedBytes += originalBytes - newBytes;
        touched += 1;
        console.log(
          `[dry-run] ${file.hash}${file.ext}: ${(originalBytes / 1024 / 1024).toFixed(1)}MB -> ${(newBytes / 1024 / 1024).toFixed(1)}MB`
        );
        continue;
      }

      // Solo se cuenta como comprimido DESPUÉS de confirmar que el archivo
      // se reemplazó de verdad — si el rename falla, cae al catch de abajo
      // y no se suma nada, en vez de reportar un éxito que no ocurrió.
      await fs.rename(tmpPath, filePath);
      await app.db.query('plugin::upload.file').update({
        where: { id: file.id },
        data: { size: newBytes / 1024 },
      });
      savedBytes += originalBytes - newBytes;
      touched += 1;
      console.log(
        `${file.hash}${file.ext}: ${(originalBytes / 1024 / 1024).toFixed(1)}MB -> ${(newBytes / 1024 / 1024).toFixed(1)}MB`
      );
    } catch (err) {
      app.log.error(`Fallo comprimiendo ${filePath}: ${err.message}`);
      skipped += 1;
    }
  }

  console.log(
    `\n${dryRun ? '[dry-run] ' : ''}Hecho: ${touched} archivos comprimidos, ${skipped} omitidos, ${(savedBytes / 1024 / 1024).toFixed(1)}MB ahorrados.`
  );

  await app.destroy();
  process.exit(0);
}

run().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});

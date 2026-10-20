'use strict';

const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs/promises');
const { isVideo, buildFfmpegArgs, runFfmpeg } = require('./utils/compress-video');

// Se engancha en beforeCreate: en ese punto el archivo ya está escrito en
// disco por el provider (provider.upload ocurre antes que el .create() de
// la base de datos que dispara este hook), así que se puede comprimir in
// situ antes de que se guarde el registro.
async function compressUploadedVideo(event, strapi) {
  const { data } = event.params;
  if (!isVideo(data.mime)) return;

  const uploadsDir = path.join(strapi.dirs.static.public, 'uploads');
  const filePath = path.join(uploadsDir, `${data.hash}${data.ext}`);
  const tmpPath = path.join(os.tmpdir(), `compressed-${data.hash}${data.ext}`);

  try {
    await runFfmpeg(buildFfmpegArgs(filePath, tmpPath));
    const compressedStat = await fs.stat(tmpPath);
    const originalBytes = data.size * 1024;
    if (compressedStat.size < originalBytes) {
      await fs.rename(tmpPath, filePath);
      data.size = compressedStat.size / 1024;
      strapi.log.info(
        `Vídeo comprimido ${data.hash}${data.ext}: ${(originalBytes / 1024 / 1024).toFixed(1)}MB -> ${(compressedStat.size / 1024 / 1024).toFixed(1)}MB`
      );
    } else {
      // El original ya era más pequeño que el resultado de ffmpeg (pasa con
      // clips muy cortos o ya comprimidos) — se deja el original tal cual.
      await fs.unlink(tmpPath).catch(() => {});
    }
  } catch (err) {
    strapi.log.error(`No se pudo comprimir el vídeo ${data.hash}${data.ext}: ${err.message}`);
    await fs.unlink(tmpPath).catch(() => {});
  }
}

module.exports = {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/*{ strapi }*/) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }) {
    // Fuerza la compresión de imágenes en cada arranque: es un ajuste
    // guardado en base de datos (Settings > Media Library), no en config,
    // así que sin esto se puede desactivar sin querer desde el admin y
    // nadie se entera hasta que el disco se llena otra vez.
    await strapi.plugin('upload').service('upload').setSettings({
      sizeOptimization: true, // jpeg/webp: calidad 100 -> 80 al subir
      responsiveDimensions: true, // genera variantes 1000/750/500px
      autoOrientation: false,
    });

    // Vídeo: Strapi no trae compresión nativa, así que se hace a mano con
    // ffmpeg cada vez que se crea un archivo de vídeo.
    strapi.db.lifecycles.subscribe({
      models: ['plugin::upload.file'],
      async beforeCreate(event) {
        await compressUploadedVideo(event, strapi);
      },
    });
  },
};

'use strict';

const { spawn } = require('node:child_process');

// ~2 Mbps de vídeo a 1080p es buena calidad para web, muy por debajo de los
// 15-50+ Mbps que graba un móvil en 4K (la causa del incidente que llenó el
// volumen de subidas la vez anterior).
const VIDEO_BITRATE = '2000k';
const AUDIO_BITRATE = '128k';
const MAX_HEIGHT = 1080;

function isVideo(mime) {
  return typeof mime === 'string' && mime.startsWith('video/');
}

function buildFfmpegArgs(inputPath, outputPath) {
  return [
    '-y',
    '-i', inputPath,
    '-c:v', 'libx264',
    '-b:v', VIDEO_BITRATE,
    '-maxrate', VIDEO_BITRATE,
    '-bufsize', '4000k',
    // Reduce solo si el vídeo es más alto que MAX_HEIGHT; nunca agranda uno pequeño.
    '-vf', `scale='-2:min(${MAX_HEIGHT},ih)'`,
    '-preset', 'veryfast',
    '-c:a', 'aac',
    '-b:a', AUDIO_BITRATE,
    '-movflags', '+faststart',
    outputPath,
  ];
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args);
    let stderr = '';
    proc.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg salió con código ${code}: ${stderr.slice(-500)}`));
    });
  });
}

module.exports = { isVideo, buildFfmpegArgs, runFfmpeg, VIDEO_BITRATE, AUDIO_BITRATE, MAX_HEIGHT };

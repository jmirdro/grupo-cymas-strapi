# Strapi example

This example deploys self-hosted version of [Strapi](https://strapi.io/). Internally it uses a PostgreSQL database to store the data.

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template/strapi?referralCode=milo)

## ✨ Features

- Strapi
- Postgres

## 💁‍♀️ How to use

- Click the Railway button 👆
- Add the environment variables
- Media will automatically be persisted between deploys!

## 💻 Developing locally

When developing locally this Strapi template will connect to the Postgres server from its public [TCP Proxy](https://docs.railway.app/deploy/exposing-your-app#tcp-proxying)

- Enable the feature flag `Template Service Eject` in the [Feature Flags](https://railway.app/account/feature-flags) menu
- Within the service settings of the Strapi service click the `Eject` button on the upstream repository
- Clone that newly created repository locally
- Install Strapi's dependencies with `yarn install` or `npm install`
- Install the Railway CLI
    - Instructions for that can be found [here](https://docs.railway.app/develop/cli#installation)
    - If this is your first time using the CLI make sure to login with `railway login`
- Within the local repository run `railway link` to link the local repository to the Strapi service on Railway
- Start Strapi for development with `railway run yarn run develop` or `railway run npm run develop`
    - This command will run Strapi in development mode with the service variables available locally
- Open your browser to `http://127.0.0.1:1337/admin`

## 📝 Notes

- After your app is deployed, visit the `/admin` endpoint to create your admin user.
- If you want to use npm with this project make sure you delete the `yarn.lock` file after you have ran `npm install`

## 🎞️ Compresión de medios

Las imágenes se comprimen automáticamente al subirlas (forzado en
`src/index.js`, calidad 80 + variantes responsive). Los vídeos pasan por
`ffmpeg` (~2 Mbps, máx. 1080p) vía un hook en el mismo archivo.

**Requisito del servidor:** `ffmpeg` tiene que estar instalado como paquete
del sistema — no es una dependencia de npm. En Railway ya está cubierto por
`railpack.json` (`deploy.aptPackages`, el builder real del proyecto es
Railpack, no Nixpacks). Fuera de Railway, instalarlo a mano
(`apt install ffmpeg` en Debian/Ubuntu). Si no está presente, la subida
sigue funcionando pero sin comprimir el vídeo (se registra el error en los
logs, no rompe la subida).

Para comprimir los archivos que ya estaban subidos antes de este cambio:

```bash
npm run backfill:media:dry-run   # solo muestra qué comprimiría, no toca nada
npm run backfill:media           # lo aplica de verdad
```

Corre contra el disco local y la base de datos — ejecutar directamente en el
servidor donde viven los archivos (vía `railway ssh` o, tras la migración,
por SSH normal al VPS), no en local.
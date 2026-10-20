'use strict';

// Reinicia el propio servicio de Strapi cada noche vía la API de Railway.
// No basta con cerrar el proceso (process.exit): la política de reinicio
// por defecto de Railway (ON_FAILURE) no revive un cierre limpio (exit 0),
// así que el sitio se quedaría caído hasta un reinicio manual. Por eso se
// llama a deploymentRestart explícitamente, que sí fuerza el reinicio.
//
// Requiere la variable de entorno RAILWAY_RESTART_TOKEN (token de proyecto
// de Railway, no de cuenta — alcance mínimo necesario).

const RAILWAY_API = 'https://backboard.railway.com/graphql/v2';
const PROJECT_ID = 'eb01166f-e16b-4bea-a17e-7f21cd5247fa';
const ENVIRONMENT_ID = '6dd97c4a-2330-4287-9459-4a7379b3ab55';
const SERVICE_ID = '938987e8-0411-485a-b6ee-b4d39ed829bb';

async function railwayGraphQL(token, query, variables) {
  const res = await fetch(RAILWAY_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) {
    throw new Error(`Railway API error: ${JSON.stringify(json.errors ?? json)}`);
  }
  return json.data;
}

async function restartStrapi({ strapi }) {
  const token = process.env.RAILWAY_RESTART_TOKEN;
  if (!token) {
    strapi.log.warn('Reinicio nocturno omitido: falta la variable RAILWAY_RESTART_TOKEN.');
    return;
  }

  try {
    const latest = await railwayGraphQL(
      token,
      `query($input: DeploymentListInput!) {
        deployments(input: $input, first: 1) {
          edges { node { id status } }
        }
      }`,
      {
        input: {
          projectId: PROJECT_ID,
          environmentId: ENVIRONMENT_ID,
          serviceId: SERVICE_ID,
          status: { in: ['SUCCESS'] },
        },
      }
    );

    const deploymentId = latest.deployments.edges[0]?.node?.id;
    if (!deploymentId) {
      strapi.log.error('Reinicio nocturno: no se encontró ningún deployment SUCCESS.');
      return;
    }

    await railwayGraphQL(token, `mutation($id: String!) { deploymentRestart(id: $id) }`, {
      id: deploymentId,
    });
    strapi.log.info(`Reinicio nocturno solicitado para el deployment ${deploymentId}.`);
  } catch (err) {
    strapi.log.error(`Reinicio nocturno falló: ${err.message}`);
  }
}

module.exports = {
  nightlyMemoryReset: {
    task: restartStrapi,
    options: {
      rule: '0 0 1 * * *', // 1:00 AM, todos los días
      tz: 'Europe/Madrid',
    },
  },
};

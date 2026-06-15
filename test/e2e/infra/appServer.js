/**
 * Cycle de vie d'un serveur applicatif (Express ou Fastify) lancé dans un
 * process Node enfant, sur le port unique du banc.
 */
const { spawn } = require('node:child_process');
const path = require('node:path');
const { axios, acceptAnyStatus } = require('../support/http');
const { pollUntil } = require('../support/flow');
const { app, rootDir } = require('../config');

const STARTUP_TIMEOUT_MS = 20_000;
const STOP_GRACE_MS      = 3_000;

/**
 * Démarre le serveur `serverFile` et attend qu'il réponde 200 sur `/health`.
 * @param {string} serverFile  nom de fichier serveur, relatif à test/e2e
 * @returns {Promise<{ stop: () => Promise<void>, getLogs: () => string }>}
 *   - stop()    : arrêt propre (SIGTERM, puis SIGKILL après un délai de grâce).
 *   - getLogs() : tout le stdout/stderr capturé (pour le diagnostic d'échec).
 */
async function startAppServer(serverFile) {
    const child = spawn(process.execPath, [path.join(rootDir, serverFile)], {
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    let logs = '';
    child.stdout.on('data', (chunk) => { logs += chunk; });
    child.stderr.on('data', (chunk) => { logs += chunk; });

    let exited = false;
    child.on('exit', () => { exited = true; });

    try {
        await pollUntil('le serveur Node /health', async () => {
            if (exited) throw new Error(`le serveur s'est arrêté:\n${logs}`);
            const res = await axios.get(`${app.url}/health`, { timeout: 2000, ...acceptAnyStatus });
            return res.status === 200;
        }, { timeoutMs: STARTUP_TIMEOUT_MS, intervalMs: 500 });
    } catch (err) {
        child.kill('SIGKILL');
        throw err;
    }

    const stop = () => new Promise((resolve) => {
        if (exited) return resolve();
        child.once('exit', resolve);
        child.kill();
        setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* déjà mort */ } resolve(); }, STOP_GRACE_MS);
    });

    return { stop, getLogs: () => logs };
}

module.exports = { startAppServer };

/**
 * Cycle de vie du serveur Keycloak (conteneur Docker) pour le banc e2e.
 */
const { spawn } = require('node:child_process');
const { axios, acceptAnyStatus } = require('../support/http');
const { pollUntil } = require('../support/flow');
const { keycloak }  = require('../config');

/**
 * Lance une commande externe en héritant de stdio. Résout sur code 0, rejette
 * sinon. `shell: true` sous Windows pour résoudre `docker` via le PATH.
 */
function runCommand(command, args) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
        child.on('error', reject);
        child.on('exit', (code) =>
            code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} → exit ${code}`)));
    });
}

/**
 * `docker compose up -d` (démarre Keycloak + importe le realm), puis attend que
 * la discovery OIDC réponde 200 avec un `token_endpoint` (Keycloak réellement prêt).
 */
async function startKeycloak() {
    console.log('▶ docker compose up -d (Keycloak + import du realm)…');
    await runCommand('docker', ['compose', 'up', '-d']);

    console.log('⏳ attente de la disponibilité de Keycloak (discovery OIDC)…');
    await pollUntil('Keycloak', async () => {
        const res = await axios.get(keycloak.discoveryUrl, { timeout: 4000, ...acceptAnyStatus });
        return res.status === 200 && !!res.data.token_endpoint;
    }, { timeoutMs: 240_000, intervalMs: 3000 });

    console.log('✓ Keycloak prêt :', keycloak.issuerUrl, '\n');
}

/** `docker compose down`. */
async function stopKeycloak() {
    console.log('\n▶ docker compose down…');
    await runCommand('docker', ['compose', 'down']);
}

module.exports = { startKeycloak, stopKeycloak };

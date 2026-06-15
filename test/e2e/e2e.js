/**
 * Test end-to-end du module sso_keycloak, 100 % local.
 *
 *   1. docker compose up           → démarre + importe le realm Keycloak
 *   2. attente readiness           → discovery OIDC joignable
 *   3. pour CHAQUE framework (express, fastify), un serveur à la fois :
 *        a. spawn du serveur Node (modes session + bearer sur un port unique)
 *        b. enchaîne les sous-tests (bearer, session, backchannel logout)
 *        c. arrêt du serveur
 *   4. un verdict final par framework ; code de sortie ≠ 0 si un test échoue.
 *
 * Structure du code :
 *   config.js      configuration (issue de .test.env)
 *   support/       primitives réutilisables (http, flow, cookieClient, reporter)
 *   infra/         systèmes externes (Keycloak, serveur app, admin API Keycloak)
 *   subtests/      les scénarios testés (bearer, session, backchannel)
 *
 * Lancement : `node e2e.js` (ajouter `--down` pour arrêter Keycloak à la fin).
 */
const { frameworks, tearDown } = require('./config');
const { startKeycloak, stopKeycloak } = require('./infra/keycloak');
const { startAppServer } = require('./infra/appServer');
const { runSubtest } = require('./support/flow');
const reporter = require('./support/reporter');

const { bearerAllowSubtest, bearerDenySubtest }   = require('./subtests/bearer');
const { sessionAllowSubtest, sessionDenySubtest } = require('./subtests/session');
const { backchannelLogoutSubtest }                = require('./subtests/backchannel');

/** Les sous-tests joués pour chaque framework, dans l'ordre. */
const SUBTESTS = [
    { name: 'bearer',      run: bearerAllowSubtest },
    { name: 'bearer-403',  run: bearerDenySubtest },
    { name: 'session',     run: sessionAllowSubtest },
    { name: 'session-403', run: sessionDenySubtest },
    { name: 'backchannel', run: backchannelLogoutSubtest },
];

/** Démarre le serveur d'un framework, joue tous les sous-tests, l'arrête. */
async function runFrameworkSuite(framework) {
    reporter.printFrameworkBanner(framework.name);

    let server;
    const subs = [];
    try {
        server = await startAppServer(framework.serverFile);
        console.log('  serveur démarré, lancement des sous-tests…');
        for (const { name, run } of SUBTESTS) {
            subs.push(await runSubtest(name, run));
        }
    } catch (err) {
        subs.push({ name: 'boot', ok: false, code: 'ERR', detail: err.message });
    } finally {
        if (server) await server.stop();
    }

    reporter.printSubtestResults(subs);
    if (server && subs.some((s) => !s.ok)) reporter.printFailureDiagnostics(server);

    return { framework: framework.name, subs, ok: subs.every((s) => s.ok) };
}

async function main() {
    await startKeycloak();

    const results = [];
    for (const framework of frameworks) {
        results.push(await runFrameworkSuite(framework));
    }

    reporter.printVerdicts(results);

    if (tearDown) await stopKeycloak();
    else console.log('\n(Keycloak reste lancé. `docker compose down` ou `node e2e.js --down` pour l\'arrêter.)');

    process.exit(results.every((r) => r.ok) ? 0 : 1);
}

main().catch((err) => { console.error('\nÉchec inattendu du runner e2e:', err); process.exit(2); });

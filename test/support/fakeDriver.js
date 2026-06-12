const DriverContrat = require('../../src/adapters/DriverContrat');

/**
 * Driver de test unique pour toute la suite.
 *
 * - Implémente TOUT le contrat DriverContrat avec des comportements neutres :
 *   si le contrat évolue, seul ce fichier est à adapter.
 * - Enregistre chaque interaction dans `calls` (spies passifs) : un test lit
 *   ce qui l'intéresse sans redéfinir le driver.
 * - `overrides` permet de remplacer une méthode pour un besoin ponctuel :
 *   makeFakeDriver({ deny: (reply, s) => { reply.status = s; } })
 *
 * Retourne { driver, calls, lastHandler } où lastHandler() est le dernier
 * handler passé à install() — raccourci pour tester le middleware de protect.
 */
function makeFakeDriver(overrides = {}) {
    const calls = {
        install:         [],     // { app, patterns, handler }
        mountAuthRoutes: [],     // { app, sso }
        mountSession:    [],     // { app, options }
        createStore:     0,
        principal:       null,   // dernier setPrincipal
        redirect:        null,   // dernière url de redirect
        deny:            null,   // dernier status de deny
        ok:              false,
        status:          null,   // dernier status envoyé (ok → 200, deny → status)
        continued:       false,  // true si la logique wrappée a appelé next()
    };

    class FakeDriver extends DriverContrat {
        getSession(req)      { return req?.session ?? {}; }
        getHeaders(req)      { return req?.headers ?? {}; }
        getBody(req)         { return req?.body ?? {}; }
        getUrl(req)          { return req?.url instanceof URL ? req.url : new URL(req?.url ?? '/', 'http://test.local'); }
        getSessionId(req)    { return req?.sessionId ?? 'sess-id'; }
        setPrincipal(req, p) { calls.principal = p; }
        redirect(reply, url) { calls.redirect = url; }
        deny(reply, status)  { calls.deny = status; calls.status = status; }
        ok(reply)            { calls.ok = true; calls.status = 200; }
        wrap(logic) {
            return async (req, reply, next) => {
                calls.continued = false;
                const continueFn = next ?? (() => {});
                await logic(req, reply, (...args) => {
                    calls.continued = true;
                    return continueFn(...args);
                });
            };
        }
        install(app, patterns, handler) { calls.install.push({ app, patterns, handler }); }
        mountAuthRoutes(app, sso)       { calls.mountAuthRoutes.push({ app, sso }); }
        createStore()                   { calls.createStore++; return {}; }
        mountSession(app, options)      { calls.mountSession.push({ app, options }); }
    }

    const driver      = Object.assign(new FakeDriver(), overrides);
    const lastHandler = () => calls.install.at(-1)?.handler ?? null;

    return { driver, calls, lastHandler };
}

module.exports = { makeFakeDriver };

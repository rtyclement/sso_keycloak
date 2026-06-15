const DriverContrat = require('./DriverContrat');

// Keycloak poste le logout_token du backchannel en
// application/x-www-form-urlencoded. Express ne parse aucun body par défaut
// et la lib ne peut pas exiger que l'application hôte ait monté
// express.urlencoded() : la route doit savoir lire son propre body.
// Ne lit le flux que s'il est encore intact (aucun parser ne l'a consommé).
function ensureFormBody(req) {
    const alreadyConsumed = req._body === true || req.readableEnded === true;
    const alreadyParsed   = req.body && Object.keys(req.body).length > 0;
    const contentType     = (req.headers?.['content-type'] ?? '').split(';')[0].trim();
    if (alreadyConsumed || alreadyParsed || contentType !== 'application/x-www-form-urlencoded') {
        return Promise.resolve();
    }
    return new Promise((resolve) => {
        let raw = '';
        req.on('data', (chunk) => { raw += chunk; });
        req.on('end', () => {
            req.body = Object.fromEntries(new URLSearchParams(raw));
            resolve();
        });
        req.on('error', () => resolve());
    });
}

class ExpressDriver extends DriverContrat {
    getSession(req)            { return req.session; }
    getHeaders(req)            { return req.headers; }
    getBody(req)               { return req.body; }
    getUrl(req)                { return new URL(req.originalUrl, `${req.protocol}://${req.headers.host ?? 'localhost'}`); }
    getSessionId(req)          { return req.sessionID; }
    setPrincipal(req, p)       { req.principal = p; }
    redirect(res, url)         { res.redirect(url); }
    deny(res, s)               { res.status(s).end(); }
    ok(res)                    { res.status(200).end(); }

    wrap(logic) {
        return (req, res, next) => {
            return Promise.resolve(logic(req, res, next)).catch(next);
        };
    }

    install(app, patterns, handler) {
        if (!patterns || patterns.length === 0) {
            app.use(handler);
            return;
        }
        app.use((req, res, next) => {
            const url = req.originalUrl.split('?')[0];
            if (!patterns.some(p => p.test(url))) return next();
            handler(req, res, next);
        });
    }
    mountAuthRoutes(app, ready) {
        const adapter = new (require('./Adapter'))(this);
        const lazy = (pick) => this.wrap(async (req, res, next) => {
            const sso = await ready;
            return pick(adapter, sso)(req, res, next);
        });

        app.get ('/login',              lazy((a, s) => a.loginRoute(s.strategies.authorizationCode)));
        app.get ('/callback',           lazy((a, s) => a.callbackRoute(s.strategies.authorizationCode, s.backchannel)));
        // Keycloak poste le logout_token en urlencoded : la route lit son propre
        // body (ensureFormBody), l'app n'a pas à monter express.urlencoded().
        // Pas de `Connection: close` : Keycloak réutilise la connexion (keep-alive)
        // pour envoyer un logout par session active — la fermer casserait la
        // livraison des logout suivants d'un même « logout all ».
        app.post('/backchannel-logout', this.wrap(async (req, res, next) => {
            await ensureFormBody(req);
            const sso = await ready;
            return adapter.backchannelRoute(sso.backchannel)(req, res, next);
        }));
    }

    createStore({ reapIntervalMs = 10 * 60 * 1000 } = {}) {
        const session = require('express-session');
        const data    = new Map();

        class ReapingStore extends session.Store {
            get(id, cb)       { cb(null, data.get(id) ?? null); }
            set(id, sess, cb) { data.set(id, sess); cb(null); }
            destroy(id, cb)   { data.delete(id); cb(null); }
        }

        const store  = new ReapingStore();
        const reaper = setInterval(() => {
            const now = Date.now();
            for (const [id, sess] of data.entries()) {
                const expires = sess?.cookie?.expires;
                if (expires && new Date(expires).getTime() < now)
                    data.delete(id);
            }
        }, reapIntervalMs);

        reaper.unref();
        return store;
    }

    mountSession(app, { sessionSecret, store, allowHttp },sessionFactory = require('express-session')) {
        app.use(sessionFactory({
            secret:            sessionSecret,
            resave:            false,
            saveUninitialized: false,
            store,
            cookie:            { secure: !allowHttp, httpOnly: true, sameSite: 'lax' },
        }));
    }
}

class FastifyDriver extends DriverContrat {
    getSession(req)            { return req.session; }
    getHeaders(req)            { return req.headers; }
    getBody(req)               { return req.body; }
    // req.host inclut le port (Fastify v5) ; req.hostname le retire, ce qui
    // casserait le redirect_uri de l'échange OAuth (port manquant).
    getUrl(req)                { return new URL(req.url, `${req.protocol}://${req.host ?? req.hostname ?? 'localhost'}`); }
    getSessionId(req)          { return req.session.sessionId; }
    setPrincipal(req, p)       { req.principal = p; }
    redirect(reply, url)       { reply.redirect(url); }
    deny(reply, s)             { reply.code(s).send(); }
    ok(reply)                  { reply.code(200).send(); }

    wrap(logic) {
        return async (req, reply) => {
            await logic(req, reply, () => {});
        };
    }
    
    install(app, patterns, handler) {
        if (!patterns || patterns.length === 0) {
            app.addHook('onRequest', handler);
            return;
        }
        app.addHook('onRequest', async (req, reply) => {
            const url = req.url.split('?')[0];
            if (!patterns.some(p => p.test(url))) return;
            await handler(req, reply);
        });
    }
    mountAuthRoutes(app, ready) {
        const adapter = new (require('./Adapter'))(this);
        const lazy = (pick) => this.wrap(async (req, reply, next) => {
            const sso = await ready;
            return pick(adapter, sso)(req, reply, next);
        });

        app.get ('/login',              lazy((a, s) => a.loginRoute(s.strategies.authorizationCode)));
        app.get ('/callback',           lazy((a, s) => a.callbackRoute(s.strategies.authorizationCode, s.backchannel)));
        // Fastify parse déjà le body urlencoded (@fastify/formbody, monté par
        // mountSession). Comme côté Express, pas de `Connection: close` : voir
        // le commentaire dans ExpressDriver.mountAuthRoutes.
        app.post('/backchannel-logout', this.wrap(async (req, reply, next) => {
            const sso = await ready;
            return adapter.backchannelRoute(sso.backchannel)(req, reply, next);
        }));
    }
    createStore({ reapIntervalMs = 10 * 60 * 1000 } = {}) {
        const data = new Map();

        const reaper = setInterval(() => {
            const now = Date.now();
            for (const [id, session] of data.entries()) {
                const expires = session?.cookie?.expires;
                if (expires && new Date(expires).getTime() < now) {
                    data.delete(id);
                }
            }
        }, reapIntervalMs);

        reaper.unref();

        return {
            get:     (id, cb) => cb(null, data.get(id) ?? null),
            set:     (id, session, cb) => { data.set(id, session); cb(null); },
            destroy: (id, cb) => { data.delete(id); cb(null); },
        };
    }
    mountSession(app, { sessionSecret, store, allowHttp },plugins = {}) {
        const cookie = plugins.cookie ?? require('@fastify/cookie');
        const session  = plugins.session  ?? require('@fastify/session');
        const formbody = plugins.formbody ?? require('@fastify/formbody');
        // Enregistrement synchrone (sans await) : les 3 plugins sont mis en file
        // AVANT que protect() ne rende la main, donc avant listen(). avvio les
        // démarre dans l'ordre d'enregistrement (cookie avant session).
        app.register(cookie);
        app.register(session, {
            secret:            sessionSecret,
            saveUninitialized: false,
            store,
            cookie: { secure: !allowHttp, httpOnly: true, sameSite: 'lax' },
        });
        app.register(formbody);
    }
}

const DRIVERS = Object.freeze({
    EXPRESS: Object.freeze(new ExpressDriver()),
    FASTIFY: Object.freeze(new FastifyDriver()),
});

module.exports = DRIVERS;
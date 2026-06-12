const DriverContrat = require('./DriverContrat');

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
            Promise.resolve(logic(req, res, next)).catch(next);
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
    mountAuthRoutes(app, sso) {
        const adapter = new (require('./Adapter'))(this);

        app.get ('/login',              adapter.loginRoute(sso.strategies.authorizationCode));
        app.get ('/callback',           adapter.callbackRoute(sso.strategies.authorizationCode, sso.backchannel));
        app.post('/backchannel-logout', adapter.backchannelRoute(sso.backchannel));
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
    getUrl(req)                { return new URL(req.url, `${req.protocol}://${req.hostname ?? 'localhost'}`); }
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
    mountAuthRoutes(app, sso) {
        const adapter = new (require('./Adapter'))(this);

        app.get ('/login',              adapter.loginRoute(sso.strategies.authorizationCode));
        app.get ('/callback',           adapter.callbackRoute(sso.strategies.authorizationCode, sso.backchannel));
        app.post('/backchannel-logout', adapter.backchannelRoute(sso.backchannel));
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
    async mountSession(app, { sessionSecret, store, allowHttp },plugins = {}) {
        const cookie = plugins.cookie ?? require('@fastify/cookie');
        const session  = plugins.session  ?? require('@fastify/session');
        const formbody = plugins.formbody ?? require('@fastify/formbody');
        await app.register(cookie);
        await app.register(session, {
            secret:            sessionSecret,
            saveUninitialized: false,
            store,
            cookie: { secure: !allowHttp, httpOnly: true, sameSite: 'lax' },
        });
        await app.register(formbody);
    }
}

const DRIVERS = Object.freeze({
    EXPRESS: Object.freeze(new ExpressDriver()),
    FASTIFY: Object.freeze(new FastifyDriver()),
});

module.exports = DRIVERS;
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

    
    install(app, routes, handler) {
        if (routes === null || routes === undefined) { app.use(handler); return; }
        const list = Array.isArray(routes) ? routes : [routes];
        for (const path of list) app.use(path, handler);
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

    
    install(app, routes, handler) {
        app.addHook('onRequest', handler);
    }
}

const DRIVERS = Object.freeze({
    EXPRESS: Object.freeze(new ExpressDriver()),
    FASTIFY: Object.freeze(new FastifyDriver()),
});

module.exports = DRIVERS;
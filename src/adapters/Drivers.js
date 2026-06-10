const DRIVERS = Object.freeze({
    EXPRESS: Object.freeze({
        getSession:   (req)        => req.session,
        getHeaders:   (req)        => req.headers,
        getBody:      (req)        => req.body,
        getUrl:       (req)        => new URL(req.originalUrl, `${req.protocol}://${req.headers.host ?? 'localhost'}`),
        getSessionId: (req)        => req.sessionID,
        setPrincipal: (req, p)     => { req.principal = p; },
        redirect:     (res, url)   => res.redirect(url),
        deny:         (res, s)     => res.status(s).end(),
        ok:           (res)        => res.status(200).end(),

        // Express : handler (req, res, next), erreurs via next(err)
        wrap: (logic) => (req, res, next) => {
            Promise.resolve(logic(req, res, next)).catch(next);
        },
    }),
    FASTIFY: Object.freeze({
        getSession:   (req)        => req.session,
        getHeaders:   (req)        => req.headers,
        getBody:      (req)        => req.body,
        getUrl:       (req)        => new URL(req.url, `${req.protocol}://${req.hostname ?? 'localhost'}`),
        getSessionId: (req)        => req.session.sessionId,
        setPrincipal: (req, p)     => { req.principal = p; },
        redirect:     (reply, url) => reply.redirect(url),
        deny:         (reply, s)   => reply.code(s).send(),
        ok:           (reply)      => reply.code(200).send(),

        // Fastify : handler async (req, reply) à 2 args, next = no-op, erreurs propagées par throw
        wrap: (logic) => async (req, reply) => {
            await logic(req, reply, () => {});
        },
    }),
});


module.exports = DRIVERS;
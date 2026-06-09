const DRIVERS = Object.freeze({
    EXPRESS: Object.freeze({
        getSession:   (req)      => req.session,
        getHeaders:   (req)      => req.headers,
        getBody:      (req)      => req.body,
        getUrl:       (req)      => new URL(req.originalUrl, `${req.protocol}://${req.headers.host ?? 'localhost'}`),
        getSessionId: (req)      => req.sessionID,
        setPrincipal: (req, p)   => { req.principal = p; },
        redirect:     (res, url) => res.redirect(url),
        deny:         (res, s)   => res.status(s).end(),
        ok:           (res)      => res.status(200).end(),
        continue:     (next)     => next(),
        onError: (next, err) => next(err)
    }),
    FASTIFY: Object.freeze({
        getSession:   (req)        => req.session,
        getHeaders:   (req)        => req.headers,
        getBody:      (req)        => req.body,
        getUrl:       (req)        => new URL(req.originalUrl, `${req.protocol}://${req.hostname ?? 'localhost'}`),
        getSessionId: (req)        => req.session.sessionId,
        setPrincipal: (req, p)     => { req.principal = p; },
        redirect:     (reply, url) => reply.redirect(url),
        deny:         (reply, s)   => reply.code(s).send(),
        ok:           (reply)      => reply.code(200).send(),
        continue:     ()           => {},
        onError: (next, err) => next(err)
    }),
});


module.exports = DRIVERS;
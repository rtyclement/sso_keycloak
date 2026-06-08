function guard(strategy) {
    return async (req, res, next) => {
        const decision = await strategy.authenticate({
            session: req.session,
            headers: req.headers,
        });
        if (decision.type === 'allow') {
            req.principal = decision.principal;
            return next();
        }
        if (decision.type === 'redirect') return res.redirect(decision.url);
        if (decision.type === 'deny')     return res.status(decision.status).end();
    };
}
function loginRoute(strategy) {
    return async (req, res) => {
        const decision = await strategy.startLogin({ session: req.session });
        if (decision.type === 'redirect') return res.redirect(decision.url);
    };
}
function callbackRoute(strategy, backchannel) {
    return async (req, res) => {
        const ctx = {
            session: req.session,
            url:     new URL(req.originalUrl, `${req.protocol}://${req.headers.host ?? 'localhost'}`),
        };
        const decision = await strategy.handleCallback(ctx);
        if (decision.type === 'session') {
            backchannel.trackSession(req.session.user?.sid, req.sessionID);
            return res.redirect(decision.redirectTo);
        }
    };
}
function backchannelRoute(backchannel)      { }

module.exports = { guard, loginRoute, callbackRoute, backchannelRoute };
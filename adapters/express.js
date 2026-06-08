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
function callbackRoute(strategy, backchannel) { }
function backchannelRoute(backchannel)      { }

module.exports = { guard, loginRoute, callbackRoute, backchannelRoute };
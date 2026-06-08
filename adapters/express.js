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
    };
}
function loginRoute(strategy)               { }
function callbackRoute(strategy, backchannel) { }
function backchannelRoute(backchannel)      { }

module.exports = { guard, loginRoute, callbackRoute, backchannelRoute };
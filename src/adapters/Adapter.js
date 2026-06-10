const DRIVERS = require("./Drivers");

class Adapter {
    constructor(driver) {
        this._driver = driver;
    }

    // Délègue l'exécution (continuation + erreurs) au driver
    _wrap(logic) {
        return this._driver.wrap(logic);
    }

    guard(strategy) {
        return this._wrap(async (req, reply, next) => {
            const decision = await strategy.authenticate({
                session: this._driver.getSession(req),
                headers: this._driver.getHeaders(req),
            });
            if (decision.type === 'allow')    { this._driver.setPrincipal(req, decision.principal); return next(); }
            if (decision.type === 'redirect') return this._driver.redirect(reply, decision.url);
            if (decision.type === 'deny')     return this._driver.deny(reply, decision.status);
        });
    }

    loginRoute(strategy) {
        return this._wrap(async (req, reply, next) => {
            const decision = await strategy.startLogin({ session: this._driver.getSession(req) });
            if (decision.type === 'redirect') return this._driver.redirect(reply, decision.url);
            return next();
        });
    }

    callbackRoute(strategy, backchannel) {
        return this._wrap(async (req, reply, next) => {
            const decision = await strategy.handleCallback({
                session: this._driver.getSession(req),
                url:     this._driver.getUrl(req),
            });
            if (decision.type === 'session') {
                backchannel.trackSession(this._driver.getSession(req).user?.sid, this._driver.getSessionId(req));
                return this._driver.redirect(reply, decision.redirectTo);
            }
            return next();
        });
    }

    backchannelRoute(backchannel) {
        return this._wrap(async (req, reply, next) => {
            const decision = await backchannel.handle({ body: this._driver.getBody(req) });
            if (decision.status === 200) return this._driver.ok(reply);
            return this._driver.deny(reply, decision.status);
        });
    }
}

Adapter.DRIVERS = DRIVERS;
module.exports = Adapter;
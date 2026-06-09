const DRIVERS = require("./Drivers");

class Adapter {
    constructor(driver) {
        this._driver = driver;
    }

    guard(strategy) {
        return async (req, reply, next) => {
            const decision = await strategy.authenticate({
                session: this._driver.getSession(req),
                headers: this._driver.getHeaders(req),
            });
            if (decision.type === 'allow')    { this._driver.setPrincipal(req, decision.principal); return this._driver.continue(next); }
            if (decision.type === 'redirect') return this._driver.redirect(reply, decision.url);
            if (decision.type === 'deny')     return this._driver.deny(reply, decision.status);
        };
    }
    loginRoute(strategy) {
        return async (req, reply) => {
            const decision = await strategy.startLogin({
                session: this._driver.getSession(req),
            });
            if (decision.type === 'redirect') return this._driver.redirect(reply, decision.url);
        };
    }
    callbackRoute(strategy, backchannel) {
        return async (req, reply) => {
            const decision = await strategy.handleCallback({
                session: this._driver.getSession(req),
                url:     this._driver.getUrl(req),
            });
            if (decision.type === 'session') {
                backchannel.trackSession(
                    this._driver.getSession(req).user?.sid,
                    this._driver.getSessionId(req),
                );
                return this._driver.redirect(reply, decision.redirectTo);
            }
        };
    }
    backchannelRoute(backchannel) {
        return async (req, reply) => {
            const decision = await backchannel.handle({
                body: this._driver.getBody(req),
            });
            this._driver.ok(reply);
        };
    }
}
Adapter.DRIVERS = DRIVERS;
module.exports = Adapter;
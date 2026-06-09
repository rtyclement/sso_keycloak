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
            if (decision.type === 'allow') {
                this._driver.setPrincipal(req, decision.principal);
                return this._driver.continue(next);
            }
        };
    }
    loginRoute(strategy)               { }
    callbackRoute(strategy, backchannel){ }
    backchannelRoute(backchannel)      { }
}
Adapter.DRIVERS = DRIVERS;
module.exports = Adapter;
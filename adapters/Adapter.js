class Adapter {
    constructor(driver) {
        this._driver = driver;
    }

    guard(strategy)                    { }
    loginRoute(strategy)               { }
    callbackRoute(strategy, backchannel){ }
    backchannelRoute(backchannel)      { }
}

module.exports = Adapter;
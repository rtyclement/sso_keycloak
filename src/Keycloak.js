function compilePattern(pattern) {
    if (pattern === null || pattern === undefined) return /\/.*/;

    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

    if (escaped.endsWith('/*')) {
        const base = escaped.slice(0, -2);
        return new RegExp(`^${base}(/.*)?$`);
    }

    return new RegExp(`^${escaped}$`);
}

function matchRule(rules, url) {
    for (const rule of rules) {
        if (rule.patterns.some(p => p.test(url))) return rule;
    }
    return null;
}
const DriverContrat = require('./adapters/DriverContrat');
const DRIVERS = require('./adapters/Drivers');

class Keycloak {
    #driver;
    #config;
    #rules = [];
    #ready;
    #authRoutesMounted= false;
    #store;

    constructor(driver, config) {
        if (!driver || !(driver instanceof DriverContrat))
            throw new Error("[Keycloak] driver invalide. Utilisez Drivers.EXPRESS ou Drivers.FASTIFY");
        if (!config)
            throw new Error("[Keycloak] config est obligatoire");

        this.#driver = driver;
        this.#config = config;
        this.#store = driver.createStore();
        this.#ready = require('./core').createSso({...config, sessionStore: this.#store});
    }

    protect(app,routes,mode,roles){
        if(!app){
            throw new Error("[Keycloak] Erreur dans l'injection de l'application");
        }
        if(!mode || !['session','bearer'].includes(mode)){
            throw new Error("[Keycloak] Erreur dans le mode de protection demandé. Mode supoorté : 'session' et 'bearer'");
        }

        const routesList = routes === null || routes === undefined
            ? [null]
            : Array.isArray(routes) ? routes : [routes];
        const patterns = routesList.map(compilePattern)

        const rolesList = roles === null || roles === undefined
            ? []
            : Array.isArray(roles) ? roles : [roles];

        this.#rules.push({
            mode: mode,
            patterns: patterns,
            roles: rolesList
        })
        if (mode === 'session' && !this.#authRoutesMounted) {
            this.#authRoutesMounted = true;
            this.#ready.then(sso => {
                this.#driver.mountSession(app, {
                    sessionSecret: this.#config.sessionSecret,
                    store:         this.#store,
                    allowHttp:     this.#config.allowHttp ?? false,
                });
                this.#driver.mountAuthRoutes(app, sso);
            });
        }

        const handler = this.#driver.wrap(async (req,reply,next)=>{
            const url   = (req.url ?? req.originalUrl ?? '/').split('?')[0];
            const match = matchRule(this.#rules, url);
            if (!match)           return next();
            if (req._ssoHandled)  return next();
            const sso = await this.#ready;
            const strategy = match.mode === 'bearer' ? sso.strategies.introspection : sso.strategies.authorizationCode;
            const decision = await strategy.authenticate({
                session: this.#driver.getSession(req),
                headers: this.#driver.getHeaders(req),
            });
            req._ssoHandled = true;
            if (decision.type === 'allow')    {
                if (match.roles.length > 0) {
                    const principalRoles = decision.principal?.roles ?? [];
                    const hasRole = match.roles.some(r => principalRoles.includes(r));
                    if (!hasRole) return this.#driver.deny(reply, 403);
                }
                this.#driver.setPrincipal(req, decision.principal);
                return next();
            }
            if (decision.type === 'redirect') return this.#driver.redirect(reply, decision.url);
            if (decision.type === 'deny')     return this.#driver.deny(reply, decision.status);
            return next();
        })

        this.#driver.install(app,patterns,handler);
    }

    getDriverType() {
    for (const [key, value] of Object.entries(DRIVERS)) {
      if (value === this.#driver) {
        return key;
      }
    }
    return undefined;
  }

    getRule(index){
        return this.#rules[index];
    }
    getRules(){
        return [...this.#rules];
    }
    ready(){
        return this.#ready;
    }
}

module.exports = Keycloak;
module.exports.compilePattern = compilePattern;
module.exports.matchRule      = matchRule;
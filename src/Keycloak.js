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

    constructor(driver, config) {
        if (!driver || !(driver instanceof DriverContrat))
            throw new Error("[Keycloak] driver invalide. Utilisez Drivers.EXPRESS ou Drivers.FASTIFY");
        if (!config)
            throw new Error("[Keycloak] config est obligatoire");

        this.#driver = driver;
        this.#config = config;
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
}

module.exports = Keycloak;
module.exports.compilePattern = compilePattern;
module.exports.matchRule      = matchRule;
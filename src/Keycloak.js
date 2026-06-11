function compilePattern(pattern) {
    if (pattern === null || pattern === undefined) return /\/.*/;

    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

    if (escaped.endsWith('/*')) {
        const base = escaped.slice(0, -2);
        return new RegExp(`^${base}(/.*)?$`);
    }

    return new RegExp(`^${escaped}$`);
}

class Keycloak {
    #framework;
    #rules = [];

    constructor({framework} = {}){
        if(!framework || !['express','fastify'].includes(framework)){
            throw new Error("[Keycloak] Erreur dans le choix du framework. Framework supporté : 'express' et 'fastify'");
        }
        this.#framework=framework;
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
    getFramework(){
        return this.#framework;
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
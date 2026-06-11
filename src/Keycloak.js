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
    constructor({framework} = {}){
        if(!framework || !['express','fastify'].includes(framework)){
            throw new Error("[Keycloak] Erreur dans le choix du framework. Framework supporté : 'express' et 'fastify'");
        }
        this._framework=framework;
        this._rules=[]
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
        this._rules.push({
            mode: mode,
            patterns: patterns
        })
    }
    getFramework(){
        return this._framework;
    }
    getRule(index){
        return this._rules[index];
    }
    getRules(){
        return this._rules;
    }
}

module.exports = Keycloak;
module.exports.compilePattern = compilePattern;
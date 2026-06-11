function compilePattern(pattern) {
    if (pattern === null || pattern === undefined) return /.*/;

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
        this.rules=[]
    }
    protect(app,routes,mode,roles){
        if(!app){
            throw new Error("[Keycloak] Erreur dans l'injection de l'application");
        }
        if(!mode || !['session','bearer'].includes(mode)){
            throw new Error("[Keycloak] Erreur dans le mode de protection demandé. Mode supoorté : 'session' et 'bearer'");
        }
        const routesListe = Array.isArray(routes) ? routes : [routes] 
        this.rules.push({
            mode: mode,
            pattern: routesListe
        })
    }
    getFramework(){
        return this._framework;
    }
    getRule(index){
        return this.rules[index];
    }
    getRules(){
        return this.rules;
    }
}

module.exports = Keycloak;
module.exports.compilePattern = compilePattern;
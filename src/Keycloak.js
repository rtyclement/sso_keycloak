class Keycloak {
    constructor({framework} = {}){
        if(!framework || !['express','fastify'].includes(framework)){
            throw new Error("[Keycloak] Erreur dans le choix du framework. Framework supporté : 'Express' et 'Fastify'");
        }
    }
    protect(app,routes,mode,roles){
        if(!app){
            throw new Error("[Keycloak] Erreur dans l'injection de l'application")
        }
    }
}

module.exports = Keycloak;
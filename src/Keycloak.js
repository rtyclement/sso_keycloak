class Keycloak {
    constructor({framework} = {}){
        if(!framework || !['express','fastify'].includes(framework)){
            throw new Error("[Keycloak] Erreur dans le choix du framework. Framework supporté : 'Express' et 'Fastify'");
        }
    }
}

module.exports = Keycloak;
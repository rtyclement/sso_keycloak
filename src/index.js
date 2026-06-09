function createSso(deps = {}, config = {}) {
    if (deps.express && deps.session) return require('./factories/express/express')(deps, config);         // flow navigateur
    if (deps.express)                 return require('./factories/express/express-bearer')(deps, config);  // bearer / API
    if (deps.fastify)                 return require('./fastify')(deps, config);
    throw new Error('[sso_keycloak] Aucun framework reconnu dans les dépendances injectées');
}
module.exports = { createSso };
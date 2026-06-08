function required(options, key) {
    if (options[key] === undefined || options[key] === null) {
        throw new Error(`[sso_keycloak] Option obligatoire manquante : "${key}"`);
    }
    return options[key];
}
async function createSso(options = {}) {
    required(options, 'issuerUrl');
    required(options, 'clientId');
    return {};
};

module.exports = {createSso};
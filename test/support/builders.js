/**
 * Builders de tests : chaque builder retourne un objet complet avec des
 * valeurs par défaut neutres, surchargeables champ par champ via `overrides`.
 * Un test ne décrit que ce qui est pertinent pour SON objectif — le reste
 * vient des défauts communs.
 */

const FAKE_METADATA = {
    introspection_endpoint: 'https://kc.example.com/realms/r/protocol/openid-connect/token/introspect',
    jwks_uri:               'https://kc.example.com/realms/r/protocol/openid-connect/certs',
};

/** Client openid-client minimal : discovery résolue avec des métadonnées fixes. */
function buildFakeClient({ onDiscovery, metadata = FAKE_METADATA } = {}) {
    return {
        discovery: async (url, clientId, clientSecret) => {
            if (onDiscovery) onDiscovery({ url, clientId, clientSecret });
            return { serverMetadata: () => metadata };
        },
    };
}

/**
 * Factories de stratégies stub : par défaut tout authenticate retourne `decision`.
 * - decision       : décision retournée par les deux stratégies (défaut : allow)
 * - onAuthenticate : spy appelé à chaque authenticate
 */
function buildStubFactories({ decision = { type: 'allow', principal: {} }, onAuthenticate } = {}) {
    const authenticate = async (ctx) => {
        if (onAuthenticate) onAuthenticate(ctx);
        return decision;
    };
    return {
        introspection:     () => ({ authenticate }),
        authorizationCode: () => ({
            authenticate,
            startLogin:     async () => ({ type: 'redirect', url: '/kc' }),
            handleCallback: async () => ({ type: 'session',  redirectTo: '/' }),
        }),
        backchannel:       () => ({ handle: async () => ({ status: 200 }), trackSession: () => {} }),
    };
}

/** Factories qui capturent les dépendances reçues (pour tester le câblage de createSso). */
function buildCapturingFactories() {
    const received     = {};
    const fakeStrategy = { authenticate: async () => ({ type: 'deny', status: 401 }) };
    const fakeHandler  = async () => {};
    return {
        authorizationCode: (deps) => { received.authorizationCode = deps; return fakeStrategy; },
        introspection:     (deps) => { received.introspection     = deps; return fakeStrategy; },
        backchannel:       (deps) => { received.backchannel       = deps; return fakeHandler;  },
        received, fakeStrategy, fakeHandler,
    };
}

/** Config complète pour `createSso` (core). Override un champ à `undefined` pour tester son absence. */
function buildSsoConfig(overrides = {}) {
    return {
        issuerUrl:    'https://kc.example.com/realms/myrealm',
        clientId:     'mon-app',
        clientSecret: 'secret-123',
        sessionStore: {},
        _client:      buildFakeClient(),
        _factories:   buildStubFactories(),
        ...overrides,
    };
}

/**
 * Config complète pour `new Keycloak(driver, config)`.
 * Les factories sont stubbées par défaut : les tests de Keycloak ne dépendent
 * jamais des vraies implémentations des handlers.
 */
function buildKeycloakConfig(overrides = {}) {
    return {
        issuerUrl:     'http://kc/realms/r',
        clientId:      'c',
        clientSecret:  's',
        sessionSecret: 'secret',
        _client:       buildFakeClient(),
        _factories:    buildStubFactories(),
        ...overrides,
    };
}

/** Client openid pour la stratégie authorizationCode (PKCE, état, échange de code). */
function buildFakeAuthClient(overrides = {}) {
    return {
        randomPKCECodeVerifier:     () => 'verifier-abc',
        calculatePKCECodeChallenge: async () => 'challenge-xyz',
        randomState:                () => 'state-123',
        buildAuthorizationUrl:      () => new URL('https://kc.example.com/authorize'),
        authorizationCodeGrant:     async () => ({ access_token: '' }),
        ...overrides,
    };
}

/** Requête de test avec la forme attendue par les drivers. */
function buildReq(overrides = {}) {
    return {
        session:   {},
        headers:   {},
        body:      {},
        url:       '/',
        sessionId: 'sess-id',
        ...overrides,
    };
}

/** JWT non signé (signature factice) pour les tests de décodage de payload. */
function makeJwt(payload) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
    const body   = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${header}.${body}.fakesig`;
}

module.exports = {
    FAKE_METADATA,
    buildFakeClient,
    buildStubFactories,
    buildCapturingFactories,
    buildSsoConfig,
    buildKeycloakConfig,
    buildFakeAuthClient,
    buildReq,
    makeJwt,
};

const FAKE_METADATA = {
    introspection_endpoint: 'https://kc.example.com/realms/r/protocol/openid-connect/token/introspect',
    jwks_uri:               'https://kc.example.com/realms/r/protocol/openid-connect/certs',
};

const BASE_OPTIONS = {
    issuerUrl:    'https://kc.example.com/realms/myrealm',
    clientId:     'mon-app',
    clientSecret: 'secret-123',
    sessionStore: {},
    requiredRole: 'admin',
};

function buildFakeClient({ onDiscovery } = {}) {
    return {
        discovery: async (url, clientId, clientSecret) => {
            if (onDiscovery) onDiscovery({ url, clientId, clientSecret });
            return { serverMetadata: () => FAKE_METADATA };
        },
    };
}

function buildFakeFactories() {
    const received   = {};
    const fakeStrategy = { authenticate: async () => ({ type: 'deny', status: 401 }) };
    const fakeHandler  = async () => {};
    return {
        authorizationCode: (deps) => { received.authorizationCode = deps; return fakeStrategy; },
        introspection:     (deps) => { received.introspection     = deps; return fakeStrategy; },
        backchannel:       (deps) => { received.backchannel       = deps; return fakeHandler;  },
        received, fakeStrategy, fakeHandler,
    };
}

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

function makeJwt(payload) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
    const body   = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${header}.${body}.fakesig`;
}

module.exports = {FAKE_METADATA, BASE_OPTIONS, buildFakeClient,buildFakeFactories,buildFakeAuthClient,makeJwt};
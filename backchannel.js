const jwksClient = require('jwks-rsa');
const jwt        = require('jsonwebtoken');

module.exports = function createBackchannel({ sessionStore, jwksUri, _verify }) {
    const jwks       = jwksClient({ jwksUri, cache: true, cacheMaxAge: 600000 });
    const sessionMap = new Map();

    function getSigningKey(header, callback) {
        jwks.getSigningKey(header.kid, (err, key) => {
            if (err) return callback(err);
            callback(null, key.getPublicKey());
        });
    }

    const verifyFn = _verify ?? jwt.verify;

    function trackSession(sid, sessionId) {
        if (sid && sessionId && !sessionMap.has(sid)) {
            sessionMap.set(sid, sessionId);
        }
    }

    function handle(ctx) {
        const logoutToken = ctx.body?.logout_token;
        if (!logoutToken) return Promise.resolve({ status: 400, reason: 'no_logout_token' });

        return new Promise((resolve) => {
            verifyFn(logoutToken, getSigningKey, { algorithms: ['RS256', 'ES256'] }, (err, decoded) => {
                if (err) return resolve({ status: 400, reason: 'invalid_token' });

                const hasLogoutEvent = decoded.events?.['http://schemas.openid.net/event/backchannel-logout'];
                if (!hasLogoutEvent) return resolve({ status: 400, reason: 'missing_event' });

                const keycloakSid = decoded.sid;
                if (!keycloakSid) return resolve({ status: 400, reason: 'missing_sid' });

                const expressSessionId = sessionMap.get(keycloakSid);
                if (expressSessionId) {
                    sessionStore.destroy(expressSessionId, () => {});
                    sessionMap.delete(keycloakSid);
                }

                resolve({ status: 200 });
            });
        });
    }

    return { handle, trackSession };
};
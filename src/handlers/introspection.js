function createIntrospection(deps) {
    return {
        authenticate: async (ctx) => {
            const header = ctx.headers['authorization'] || '';
            const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
            if (!token) return { type: 'deny', status: 401, reason: 'no_token' };

            const fetchFn = deps.fetch ?? globalThis.fetch;
            const basic   = 'Basic ' + Buffer.from(`${deps.clientId}:${deps.clientSecret}`).toString('base64');
            const res     = await fetchFn(deps.introspectUrl, {
                method:  'POST',
                headers: { 'Authorization': basic, 'Content-Type': 'application/x-www-form-urlencoded' },
                body:    new URLSearchParams({ token }),
            });
            const data = await res.json();

            if (!data.active) return { type: 'deny', status: 401, reason: 'inactive_token' };

            const roles = data.resource_access?.[deps.audienceClientId]?.roles ?? [];
            if (!roles.includes(deps.requiredRole))
                return { type: 'deny', status: 403, reason: 'missing_role' };

            return {type: 'allow', principal: data};
        },
    };
}

module.exports = createIntrospection;
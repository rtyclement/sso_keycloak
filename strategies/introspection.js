function createIntrospection(deps) {
    return {
        authenticate: async (ctx) => {
            const header = ctx.headers['authorization'] || '';
            const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
            if (!token) return { type: 'deny', status: 401, reason: 'no_token' };
            return {};
        },
    };
}

module.exports = createIntrospection;
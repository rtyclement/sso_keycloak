function createIntrospection(deps) {
    return {
        authenticate: async (ctx) => {
            const header = ctx.headers['authorization'];
            if (!header) return { type: 'deny', status: 401, reason: 'no_token' };
            return {};
        },
    };
}

module.exports = createIntrospection;
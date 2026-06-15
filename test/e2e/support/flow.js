/**
 * Primitives de déroulé des tests : attente active, assertions, et exécution
 * isolée d'un sous-test. Aucune dépendance réseau ni métier ici.
 */

/** Pause non bloquante de `ms` millisecondes. */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Répète `check` jusqu'à ce qu'elle renvoie une valeur vraie, ou lève au bout
 * de `timeoutMs`. Les exceptions levées par `check` sont avalées (on réessaie) ;
 * la dernière est annexée au message de timeout pour faciliter le diagnostic.
 * @param {string}   label                ce qu'on attend (pour le message d'erreur)
 * @param {() => Promise<boolean>} check  condition à satisfaire
 * @param {{timeoutMs:number, intervalMs?:number}} options
 */
async function pollUntil(label, check, { timeoutMs, intervalMs = 1000 }) {
    const deadline = Date.now() + timeoutMs;
    let lastError;
    while (Date.now() < deadline) {
        try {
            if (await check()) return;
        } catch (err) {
            lastError = err;
        }
        await sleep(intervalMs);
    }
    const cause = lastError ? ` (dernier: ${lastError.message})` : '';
    throw new Error(`Timeout en attendant ${label}${cause}`);
}

/**
 * Échec d'une étape de sous-test, porteur d'un `code` (statut HTTP ou 'ERR')
 * affiché dans le rapport.
 */
class StepFailure extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

/** Assertion de sous-test : lève une StepFailure si `condition` est fausse. */
function assert(condition, code, message) {
    if (!condition) throw new StepFailure(code, message);
}

/**
 * Exécute un sous-test et normalise son issue en `{ name, ok, code, detail }`,
 * sans jamais propager : un sous-test raté n'interrompt pas les suivants.
 * @param {string} name
 * @param {() => Promise<string>} run  renvoie un libellé de succès, ou lève
 */
async function runSubtest(name, run) {
    try {
        const detail = await run();
        return { name, ok: true, code: 200, detail };
    } catch (err) {
        if (err instanceof StepFailure) return { name, ok: false, code: err.code, detail: err.message };
        return { name, ok: false, code: 'ERR', detail: err.stack || err.message };
    }
}

module.exports = { sleep, pollUntil, StepFailure, assert, runSubtest };

/**
 * Primitives HTTP partagées par les sous-tests et l'infra.
 */
const axios = require('axios');

/**
 * Option axios : ne JAMAIS rejeter selon le statut HTTP. Les sous-tests
 * vérifient eux-mêmes le statut via `assert`, et veulent observer les 4xx/5xx
 * (ex. 401, 403, 302) plutôt que de les voir transformés en exceptions.
 */
const acceptAnyStatus = { validateStatus: () => true };

/**
 * POST `application/x-www-form-urlencoded` (le format des endpoints token et
 * du formulaire de login Keycloak), sans rejet sur statut.
 * @param {string} url
 * @param {Record<string,string>} fields  paires encodées dans le corps
 * @param {object} [extra]                options axios additionnelles
 */
function postForm(url, fields, extra = {}) {
    return axios.post(url, new URLSearchParams(fields), {
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        validateStatus: () => true,
        ...extra,
    });
}

module.exports = { axios, acceptAnyStatus, postForm };

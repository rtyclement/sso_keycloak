/**
 * @typedef {Object} DriverContrat
 * @property {(req: any) => any}                     getSession    Récupère l'objet session de la requête
 * @property {(req: any) => any}                     getHeaders    Récupère les headers HTTP
 * @property {(req: any) => any}                     getBody       Récupère le body parsé
 * @property {(req: any) => URL}                     getUrl        Construit l'URL complète de la requête
 * @property {(req: any) => string}                  getSessionId  Récupère l'identifiant de session
 * @property {(req: any, principal: any) => void}    setPrincipal  Attache le principal authentifié à la requête
 * @property {(reply: any, url: string) => void}     redirect      Redirige (302) vers une URL
 * @property {(reply: any, status: number) => void}  deny          Refuse l'accès avec un code HTTP
 * @property {(reply: any) => void}                  ok            Répond 200
 * @property {(logic: Function) => Function}         wrap          Adapte la logique au modèle d'exécution du framework
 * @property {(app: any, patterns: RegExp[], handler: Function) => void} install  Installe le handler sur l'app
 * @property {(app: any, sso: Function) => void}     mountAuthRoutes  créer les routes HTTP pour le mode session de protect
 * @property {()=> Object}                           createStore   Crée un memory store avec TTL pour éviter les fuites mémoires
*/

/**
 * Classe abstraite définissant le contrat qu'un driver de framework doit respecter.
 * Toute méthode non surchargée lève une erreur à l'exécution.
 * Pour ajouter un framework : étendre cette classe et implémenter les 11 méthodes.
 * @implements {DriverContrat}
 */
class DriverContrat {
    getSession(req)            { throw new Error("[Driver] getSession() not implemented"); }
    getHeaders(req)            { throw new Error("[Driver] getHeaders() not implemented"); }
    getBody(req)               { throw new Error("[Driver] getBody() not implemented"); }
    getUrl(req)                { throw new Error("[Driver] getUrl() not implemented"); }
    getSessionId(req)          { throw new Error("[Driver] getSessionId() not implemented"); }
    setPrincipal(req, principal) { throw new Error("[Driver] setPrincipal() not implemented"); }
    redirect(reply, url)       { throw new Error("[Driver] redirect() not implemented"); }
    deny(reply, status)        { throw new Error("[Driver] deny() not implemented"); }
    ok(reply)                  { throw new Error("[Driver] ok() not implemented"); }
    wrap(logic)                { throw new Error("[Driver] wrap() not implemented"); }
    install(app, patterns, handler) { throw new Error("[Driver] install() not implemented"); }
    mountAuthRoutes(app, sso) { throw new Error("[Driver] mountAuthRoutes() not implemented"); }
    createStore(){ throw new Error("[Driver] createStore() not implemented"); }
}

module.exports = DriverContrat;
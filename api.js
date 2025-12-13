/**
 * Classe client pour interagir avec l'API Finary.
 * Gère l'authentification, les requêtes API, la gestion des biens immobiliers, et la configuration utilisateur.
 */
import { flattenAssets } from './src/asset-flattener.js';

export class FinaryClient {
    /**
     * Initialise le client Finary.
     */
    constructor() {
        this.token = null;
        this.baseUrl = 'https://api.finary.com';
        this.MAX_RETRIES = 3;
        this.RETRY_DELAY = 2000;
    }

    /**
     * Récupère le token de session stocké localement.
     * @returns {Promise<string|null>} Le token de session ou null.
     */
    async getSessionToken() {
        return new Promise((resolve) => {
            chrome.storage.local.get('sessionToken', (result) => {
                resolve(result.sessionToken || null);
            });
        });
    }

    /**
     * Enregistre le token de session dans le stockage local.
     * @param {string} token - Le token à enregistrer.
     * @returns {Promise<void>}
     */
    async setSessionToken(token) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ sessionToken: token }, resolve);
        });
    }

    /**
     * Demande un nouveau token de session, avec gestion du retry.
     * @param {number} [retryCount=0] - Nombre de tentatives déjà effectuées.
     * @returns {Promise<string>} Le nouveau token de session.
     */
    async requestNewToken(retryCount = 0) {
        console.log(`🔄 Tentative ${retryCount + 1}/${this.MAX_RETRIES + 1} de renouvellement du token...`);

        return new Promise((resolve, reject) => {
            chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
                if (!tabs[0]) {
                    const error = "Aucun onglet actif trouvé - Veuillez ouvrir Finary dans un onglet";
                    console.error(`❌ ${error}`);
                    
                    if (retryCount < this.MAX_RETRIES) {
                        console.log(`⏳ Nouvelle tentative dans ${this.RETRY_DELAY/1000}s...`);
                        await new Promise(r => setTimeout(r, this.RETRY_DELAY));
                        resolve(this.requestNewToken(retryCount + 1));
                        return;
                    }
                    reject(error);
                    return;
                }

                const timeoutId = setTimeout(() => {
                    const error = "Délai d'attente dépassé pour la réponse";
                    console.error(`❌ ${error}`);
                    
                    if (retryCount < this.MAX_RETRIES) {
                        console.log(`⏳ Nouvelle tentative dans ${this.RETRY_DELAY/1000}s...`);
                        setTimeout(() => {
                            resolve(this.requestNewToken(retryCount + 1));
                        }, this.RETRY_DELAY);
                        return;
                    }
                    reject(error);
                }, 10000);

                chrome.tabs.sendMessage(tabs[0].id, { action: "REQUEST_TOKEN" }, async (response) => {
                    clearTimeout(timeoutId);

                    if (chrome.runtime.lastError) {
                        console.error("❌ Erreur lors de l'envoi du message:", chrome.runtime.lastError);
                        
                        if (retryCount < this.MAX_RETRIES) {
                            console.log(`⏳ Nouvelle tentative dans ${this.RETRY_DELAY/1000}s...`);
                            await new Promise(r => setTimeout(r, this.RETRY_DELAY));
                            resolve(this.requestNewToken(retryCount + 1));
                            return;
                        }
                        reject(chrome.runtime.lastError);
                        return;
                    }

                    if (response?.token) {
                        await this.setSessionToken(response.token);
                        console.log("✅ Token mis à jour avec succès!");
                        resolve(response.token);
                    } else {
                        const error = "Réponse invalide lors du renouvellement du token";
                        console.error(`❌ ${error}`, response);
                        
                        if (retryCount < this.MAX_RETRIES) {
                            console.log(`⏳ Nouvelle tentative dans ${this.RETRY_DELAY/1000}s...`);
                            await new Promise(r => setTimeout(r, this.RETRY_DELAY));
                            resolve(this.requestNewToken(retryCount + 1));
                            return;
                        }
                        reject(error);
                    }
                });
            });
        });
    }

    /**
     * Attend un délai donné (en ms).
     * @param {number} ms - Durée en millisecondes.
     * @returns {Promise<void>}
     */
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Effectue une requête API générique avec gestion du token et des erreurs.
     * @param {string} endpoint - L'endpoint de l'API (ex: "/users/me").
     * @param {Object} [options={}] - Options fetch (méthode, headers, body...).
     * @returns {Promise<any>} La réponse de l'API ou null en cas d'erreur.
     */
    async apiRequest(endpoint, options = {}, contextInfo = {}) {
        let retryCount = 0;

        const executeRequest = async () => {
            try {
                if (!this.token) {
                    this.token = await this.getSessionToken();
                    if (!this.token) {
                        console.log("❌ Aucun token disponible, demande d'un nouveau...");
                        this.token = await this.requestNewToken();
                        if (!this.token) {
                            throw new Error("Impossible d'obtenir un token valide");
                        }
                    }
                }

                const headers = {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                    ...options.headers
                };

                const response = await fetch(`${this.baseUrl}${endpoint}`, {
                    ...options,
                    headers
                });

                if (!response.ok) {
                    if (response.status === 401) {
                        throw new Error('TOKEN_EXPIRE');
                    }
                    if (response.status === 400) {
                        let errorDetails = "";
                        try {
                            errorDetails = await response.text();
                        } catch (e) {}
                        console.error("❌ HTTP 400 - Bad Request", {
                            endpoint,
                            data: options.body,
                            context: contextInfo,
                            apiError: errorDetails
                        });
                    }
                    if (response.status === 500 && retryCount < this.MAX_RETRIES) {
                        retryCount++;
                        console.log(`🔄 Retry ${retryCount}/${this.MAX_RETRIES} after 500 error`);
                        await this.delay(this.RETRY_DELAY);
                        return executeRequest();
                    }
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const contentType = response.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    const text = await response.text();
                    if (!text) {
                        console.log("⚠️ Empty response received");
                        return null;
                    }
                    try {
                        const parsed = JSON.parse(text);
                        // Ajoute ce log pour afficher le contexte à chaque appel
                        if (Object.keys(contextInfo).length > 0) {
                            console.log("✅ API call context:", {
                                endpoint,
                                data: options.body,
                                context: contextInfo
                            });
                        }
                        return parsed;
                    } catch (e) {
                        console.error("❌ JSON parse error:", e);
                        throw new Error(`Invalid JSON response: ${text.substring(0, 100)}...`);
                    }
                }
                
                return { success: response.ok };

            } catch (error) {
                if (error.message === 'TOKEN_EXPIRE') {
                    console.log("🔄 Token expiré, renouvellement...");
                    this.token = await this.requestNewToken();
                    if (!this.token) {
                        throw new Error("Impossible de renouveler le token");
                    }
                    return executeRequest();
                }
                throw error;
            }
        };

        try {
            return await executeRequest();
        } catch (error) {
            console.error("❌ Échec de la requête API:", error.message);
            if (error.message.includes('500')) {
                console.error("⚠️ Server error (500) - The request might have succeeded despite the error");
            }
            return null;
        }
    }

    /**
     * Récupère l'ID du membership sélectionné pour l'utilisateur courant.
     * @returns {Promise<string|null>} L'ID du membership ou null.
     */
    async getSelectedMembershipId() {
        try {
            const response = await this.apiRequest("/users/me");
            if (!response?.result?.ui_configuration?.selected_membership?.id) {
                throw new Error("Selected membership ID not found in user configuration");
            }
            console.log("Selected membership ID:", response.result.ui_configuration.selected_membership.id);
            return response.result.ui_configuration.selected_membership.id;
        } catch (error) {
            console.error("❌ Error getting selected membership ID:", error.message);
            return null;
        }
    }

    /**
     * Récupère l'organisation sélectionnée pour l'utilisateur courant.
     * @returns {Promise<string|null>} L'ID de l'organisation ou null.
     */
    async getSelectedOrganization() {
        try {
            const response = await this.apiRequest("/users/me/organizations");
            if (!Array.isArray(response?.result) || response.result.length === 0) {
                throw new Error("Organization list is empty in response");
            }
            // Prend la première organisation par défaut
            const orgId = response.result[0].id;
            console.log("Selected organization ID:", orgId);
            return orgId;
        } catch (error) {
            console.error("❌ Error getting selected organization ID:", error.message);
            return null;
        }
    }

    /**
     * Récupère les comptes de holdings courants pour une organisation et un membership donnés.
     * @param {string} organizationID - L'ID de l'organisation.
     * @param {string} membershipID - L'ID du membership.
     * @returns {Promise<Object|null>} Les comptes de holdings ou null en cas d'erreur.
     */
    async getCurrentHoldingsAccounts(organizationID, membershipID) {
        try {
            const endpoint = `/organizations/${organizationID}/memberships/${membershipID}/holdings_accounts`;
            const response = await this.apiRequest(endpoint);
            if (!response?.result) {
                throw new Error("Holdings accounts not found in response");
            }
            console.log("Holdings accounts:", response.result);
            return response.result;
        } catch (error) {
            console.error("❌ Error getting holdings accounts:", error.message);
            return null;
        }
    }

    /**
     * Récupère et aplatit les holdings accounts pour une organisation/membership donnés.
     * Utilise `flattenAssets` pour produire une liste plate d'actifs.
     * @returns {Promise<Array>} Liste d'actifs aplatis ou tableau vide en cas d'erreur.
     */
    async getFlattenedCurrentHoldingsAccounts(organizationID, membershipID) {
        try {
            const endpoint = `/organizations/${organizationID}/memberships/${membershipID}/holdings_accounts`;
            const response = await this.apiRequest(endpoint);
            if (!response) {
                console.warn('No response from holdings_accounts endpoint');
                return [];
            }
            // flattenAssets expects an object with a `result` array
            return flattenAssets(response);
        } catch (err) {
            console.error('❌ Error getting flattened holdings accounts:', err);
            return [];
        }
    }

    /**
     * Met à jour la devise d'affichage de l'utilisateur.
     * @param {string} currencyCode - Code de la devise (ex: "USD").
     * @returns {Promise<Object>} La réponse de l'API.
     * @throws {Error} Si la mise à jour échoue.
     */
    async updateDisplayCurrency(currencyCode) {
        const response = await this.apiRequest("/users/me", {
            method: "PATCH",
            body: JSON.stringify({
                ui_configuration: {
                    display_currency: {
                        code: currencyCode
                    }
                }
            })
        });

        if (!response?.result) {
            throw new Error(`Failed to update display currency to ${currencyCode}`);
        }

        const actualCurrency = response.result.ui_configuration.display_currency.code;
        if (actualCurrency !== currencyCode) {
            throw new Error(`Currency update failed. Expected ${currencyCode}, got ${actualCurrency}`);
        }

        console.log(`Display currency successfully updated to ${currencyCode}`);
        return response;
    }

    /**
     * Récupère le place_id Finary correspondant à une adresse.
     * @param {string} address - L'adresse à rechercher.
     * @returns {Promise<string|null>} Le place_id ou null si non trouvé.
     */
    async getPlaceId(address) {
        const encodedAddress = encodeURIComponent(address);
        const response = await this.apiRequest(`/real_estates/autocomplete?query=${encodedAddress}`);
        
        if (!response?.result?.[0]?.place_id) {
            console.warn(`No place_id found for address: ${address}`);
            return null;
        }

        console.log(`Found place_id for ${address}:`, response.result[0].place_id);
        return response.result[0].place_id;
    }

    /**
     * Récupère la liste des biens immobiliers de l'utilisateur.
     * @returns {Promise<Object>} Liste des biens immobiliers.
     */
    async getRealEstateAssets() {
        return await this.apiRequest('/users/me/real_estates');
    }

    /**
     * Ajoute un bien immobilier à l'utilisateur.
     * @param {Object} data - Données du bien immobilier à ajouter.
     * @returns {Promise<Object>} La réponse de l'API.
     */
    async addRealEstateAsset(data) {
        return await this.apiRequest('/users/me/real_estates', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * Met à jour un bien immobilier existant.
     * @param {string} id - L'identifiant du bien à mettre à jour.
     * @param {Object} data - Les nouvelles données du bien.
     * @returns {Promise<Object>} La réponse de l'API.
     */
    async updateRealEstateAsset(id, data) {
        return await this.apiRequest(`/users/me/real_estates/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        }, { id, data });
    }

    /**
     * Supprime un bien immobilier existant.
     * @param {string} id - L'identifiant du bien à supprimer.
     * @returns {Promise<Object>} La réponse de l'API.
     */
    async deleteRealEstateAsset(id) {
        return await this.apiRequest(`/users/me/real_estates/${id}`, {
            method: 'DELETE'
        });
    }

    /**
     * Récupère la liste des actifs de crowdlending de l'utilisateur.
     * @returns {Promise<Object>} Liste des actifs de crowdlending.
     */
    async getCrowdlendingAssets() {
        return await this.apiRequest('/users/me/crowdlendings');
    }

    /**
     * Ajoute un actif de crowdlending à l'utilisateur.
     * @param {Object} data - Données de l'actif à ajouter.
     * @returns {Promise<Object>} La réponse de l'API.
     */
    async addCrowdlendingAsset(data) {
        return await this.apiRequest('/users/me/crowdlendings', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * Met à jour un actif de crowdlending existant.
     * @param {string} id - L'identifiant de l'actif à mettre à jour.
     * @param {Object} data - Les nouvelles données de l'actif.
     * @returns {Promise<Object>} La réponse de l'API.
     */
    async updateCrowdlendingAsset(id, data) {
        return await this.apiRequest(`/users/me/crowdlendings/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    /**
     * Supprime un actif de crowdlending existant.
     * @param {string} id - L'identifiant de l'actif à supprimer.
     * @returns {Promise<Object>} La réponse de l'API.
     */
    async deleteCrowdlendingAsset(id) {
        return await this.apiRequest(`/users/me/crowdlendings/${id}`, {
            method: 'DELETE'
        });
    }

    /**
     * Récupère les comptes de portefeuille de l'utilisateur.
     * @returns {Promise<Object>} Liste des comptes de portefeuille.
     */
    async getHoldingsAccounts() {
        return await this.apiRequest('/users/me/holdings_accounts');
    }

    /**
     * Crée un compte de portefeuille pour l'utilisateur.
     * @param {Object} data - Données du compte à créer.
     * @returns {Promise<Object>} La réponse de l'API.
     */
    async createHoldingsAccount(data) {
        return await this.apiRequest('/users/me/holdings_accounts', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
}
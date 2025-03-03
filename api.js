export class FinaryClient {
    constructor() {
        this.token = null;
        this.baseUrl = 'https://api.finary.com';
    }

    async getSessionToken() {
        return new Promise((resolve) => {
            chrome.storage.local.get('sessionToken', (result) => {
                resolve(result.sessionToken || null);
            });
        });
    }

    async setSessionToken(token) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ sessionToken: token }, resolve);
        });
    }

    async requestNewToken() {
    console.log("🔄 Demande de mise à jour du token de session...");
    return new Promise((resolve, reject) => {
        // Trouver d'abord l'onglet actif
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (!tabs[0]) {
                reject("Aucun onglet actif trouvé");
                return;
            }
            
            // Définir un timeout pour la réponse
            const timeoutId = setTimeout(() => {
                reject("Délai d'attente dépassé pour la réponse");
            }, 10000); // 10 secondes de timeout

            // Envoyer le message à l'onglet spécifique
            chrome.tabs.sendMessage(tabs[0].id, { action: "REQUEST_TOKEN" }, (response) => {
                clearTimeout(timeoutId); // Annuler le timeout

                if (chrome.runtime.lastError) {
                    console.error("Erreur lors de l'envoi du message à content.js:", chrome.runtime.lastError);
                    reject(chrome.runtime.lastError);
                    return;
                }

                if (response && response.token) {
                    chrome.storage.local.set({ sessionToken: response.token }, () => {
                        console.log("✅ Token mis à jour automatiquement !");
                        resolve(response.token);
                    });
                } else {
                    console.error("Erreur lors de la mise à jour du token:", response);
                    reject("Erreur lors de la mise à jour du token");
                }
            });
        });
    });
}

// Fonction générique pour effectuer une requête API avec gestion des erreurs et du token expiré
async apiRequest(endpoint, options = {}) {
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

        const executerRequete = async (token) => {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                ...options,
                headers: {
                    ...options.headers,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('TOKEN_EXPIRE');
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        };

        try {
            return await executerRequete(this.token);
        } catch (error) {
            if (error.message === 'TOKEN_EXPIRE') {
                console.log("🔄 Token expiré, renouvellement...");
                this.token = await this.requestNewToken();
                if (!this.token) {
                    throw new Error("Impossible de renouveler le token");
                }
                return await executerRequete(this.token);
            }
            throw error;
        }
    } catch (error) {
        console.error("❌ Échec de la requête API:", error.message);
        return null;
    }
}

// Add specific API methods

async getPlaceId(address) {
    try {
        // Encode address for URL
        const encodedAddress = encodeURIComponent(address);
        
        // Make API request
        const response = await this.apiRequest(`/real_estates/autocomplete?query=${encodedAddress}`);
        
        if (!response?.result?.[0]?.place_id) {
            console.warn(`No place_id found for address: ${address}`);
            return null;
        }

        console.log(`Found place_id for ${address}:`, response.result[0].place_id);
        return response.result[0].place_id;
        
    } catch (error) {
        console.error('Error getting place_id:', error);
        throw error;
    }
}

async getRealEstateAssets() {
    return await this.apiRequest('/users/me/real_estates');
}

async addRealEstateAsset(data) {
    return await this.apiRequest('/users/me/real_estates', {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

async updateRealEstateAsset(data) {
    return await this.apiRequest(`/users/me/real_estates/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
}

async deleteRealEstateAsset(id) {
    return await this.apiRequest(`/users/me/real_estates/${id}`, {
        method: 'DELETE'
    });
}
}
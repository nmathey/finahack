export class FinaryClient {
    constructor() {
        this.token = null;
        this.baseUrl = 'https://api.finary.com';
        this.MAX_RETRIES = 3;
        this.RETRY_DELAY = 2000; // 2 seconds
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

    // Fonction utilitaire pour attendre un délai
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Fonction générique pour effectuer une requête API avec gestion des erreurs et du token expiré
    async apiRequest(endpoint, options = {}) {
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
                    if (response.status === 500 && retryCount < this.MAX_RETRIES) {
                        retryCount++;
                        console.log(`🔄 Retry ${retryCount}/${this.MAX_RETRIES} after 500 error`);
                        await this.delay(this.RETRY_DELAY);
                        return executeRequest();
                    }
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                // Handle empty responses (particularly for DELETE operations)
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    const text = await response.text(); // Get response as text first
                    if (!text) {
                        console.log("⚠️ Empty response received");
                        return null;
                    }
                    try {
                        return JSON.parse(text); // Parse the text as JSON
                    } catch (e) {
                        console.error("❌ JSON parse error:", e);
                        throw new Error(`Invalid JSON response: ${text.substring(0, 100)}...`);
                    }
                }
                
                // For non-JSON responses (like DELETE operations)
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

    // Add specific API methods
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

    async getRealEstateAssets() {
        return await this.apiRequest('/users/me/real_estates');
    }

    async addRealEstateAsset(data) {
        return await this.apiRequest('/users/me/real_estates', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async updateRealEstateAsset(id, data) {
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
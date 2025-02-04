// Fonction pour récupérer le token de session stocké
export async function getSessionToken() {
    return new Promise((resolve) => {
        chrome.storage.local.get("sessionToken", (data) => {
            if (chrome.runtime.lastError) {
                console.error("Erreur lors de la récupération du token de session:", chrome.runtime.lastError);
                resolve(null);
            } else {
                resolve(data.sessionToken);
            }
        });
    });
}

export async function requestNewToken() {
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
export async function apiRequest(endpoint, method = "GET", body = null) {
    async function executerRequete(token) {
        const apiUrl = `https://api.finary.com${endpoint}`;
        const headers = {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        };

        const options = { method, headers };
        if (["POST", "PUT", "PATCH"].includes(method) && body) {
            options.body = JSON.stringify(body);
        }

        console.log(`📡 Exécution de la requête ${method} vers ${endpoint}`);
        const response = await fetch(apiUrl, options);
        
        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('TOKEN_EXPIRE');
            }
            throw new Error(`Erreur HTTP! statut: ${response.status}`);
        }
        
        return await response.json();
    }

    try {
        // Première tentative avec le token actuel
        let token = await getSessionToken();
        if (!token) {
            console.log("❌ Aucun token disponible, demande d'un nouveau...");
            token = await requestNewToken();
            if (!token) {
                throw new Error("Impossible d'obtenir un token valide");
            }
        }

        try {
            return await executerRequete(token);
        } catch (error) {
            if (error.message === 'TOKEN_EXPIRE') {
                console.log("🔄 Token expiré, renouvellement...");
                token = await requestNewToken();
                if (!token) {
                    throw new Error("Impossible de renouveler le token");
                }
                // Nouvelle tentative avec le nouveau token
                console.log("🔄 Nouvelle tentative avec le token renouvelé");
                return await executerRequete(token);
            }
            throw error;
        }
    } catch (error) {
        console.error("❌ Échec de la requête API:", error.message);
        return null;
    }
}
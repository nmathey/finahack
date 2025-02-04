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
            
            // Envoyer le message à l'onglet spécifique
            chrome.tabs.sendMessage(tabs[0].id, { action: "REQUEST_TOKEN" }, (response) => {
                console.log("Message envoyé à content.js pour demander un nouveau token");
                if (chrome.runtime.lastError) {
                    console.error("Erreur lors de l'envoi du message à content.js:", chrome.runtime.lastError);
                    reject(chrome.runtime.lastError);
                } else if (response && response.token) {
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
    let token = await getSessionToken();
    if (!token) {
        console.error("❌ Aucun token disponible, demande de rafraîchissement...");
        token = await requestNewToken();
        if (!token) return null;
    }

    const apiUrl = `https://api.finary.com${endpoint}`;
    let headers = {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
    };

    let options = { method, headers };

    // Ajouter un body uniquement si la méthode est POST, PUT ou PATCH
    if (["POST", "PUT", "PATCH"].includes(method) && body) {
        options.body = JSON.stringify(body);
    }

    try {
        let response = await fetch(apiUrl, options);

        if (response.status === 401) {
            console.warn("🔄 Token expiré, tentative de rafraîchissement...");
            token = await requestNewToken();
            if (token) {
                headers["Authorization"] = `Bearer ${token}`;
                options.headers = headers;
                response = await fetch(apiUrl, options);
            } else {
                return null;
            }
        }

        if (!response.ok) {
            console.error(`❌ Erreur API (${response.status}):`, await response.text());
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error("❌ Erreur lors de la requête API :", error);
        return null;
    }
}
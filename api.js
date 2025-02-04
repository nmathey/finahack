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

// Fonction générique pour effectuer une requête API avec gestion des erreurs et du token expiré
export async function apiRequest(endpoint, method = "GET", body = null) {
    let token = await getSessionToken();
    if (!token) {
        console.error("❌ Aucun token disponible, demande de rafraîchissement...");
        requestNewToken();
        return null;
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
            requestNewToken();
            return null;
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
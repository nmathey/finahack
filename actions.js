import { apiRequest, getSessionToken } from "./api.js";
import { RealTSync } from "./realt-sync.js";

export async function handleMenuClick(info, tab) {
    const token = await getSessionToken();
    if (!token) {
        console.error("Token de session non disponible");
        return;
    }
    if (info.menuItemId === "showJsonTab_holdings") {
        chrome.storage.local.get('holdings', (result) => {
            if (result.holdings) {
                chrome.tabs.create({ url: chrome.runtime.getURL("json_viewer_holdings.html") });
            } else {
                console.error("Pas de données JSON disponibles.");
            }
        });
    } else if (info.menuItemId === "showAssetsSummary") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length === 0) {
                console.error("Aucun onglet actif trouvé.");
                return;
            }
            
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                files: ["consolidateAssets.js"]
            }, () => {
                if (chrome.runtime.lastError) {
                    console.error("Erreur lors de l'injection du script:", chrome.runtime.lastError);
                } else {
                    chrome.tabs.sendMessage(tabs[0].id, { action: "openAssetsModal" });
                }
            });
        });
    } else if (info.menuItemId === "addRealEstate") {
        chrome.tabs.sendMessage(tab.id, { action: "openRealEstateForm" });
    } else if (info.menuItemId === "showDisplayCurrencyCode") {
        const userData = await apiRequest("/users/me", "GET", token);
        if (userData) {
            chrome.notifications.create({
                type: "basic",
                iconUrl: "extension_icon128.png",
                title: "Devise Configurée",
                message: `Devise actuelle : ${userData.result.ui_configuration.display_currency.code}`
            });
        }
    } else if (info.menuItemId === "showRealTTokens") {
        const tokens = await RealTSync.getAllRealTTokens();
        chrome.storage.local.set({ 'realtTokens': tokens }, () => {
            chrome.tabs.create({ url: chrome.runtime.getURL("json_viewer_realt.html") });
        });
    } else if (info.menuItemId === "setRealTToken") {
        chrome.windows.create({
            url: chrome.runtime.getURL("token-input.html"),
            type: "popup",
            width: 500,
            height: 300
        });
    }
}
import { FinaryClient } from "./api.js";
import { RealTSync } from "./realt-sync.js";

export async function handleMenuClick(info, tab) {
    const finaryClient = new FinaryClient();
    const token = await finaryClient.getSessionToken();
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
    } else if (info.menuItemId === "setRealTToken") {
        chrome.windows.create({
            url: chrome.runtime.getURL("token-input.html"),
            type: "popup",
            width: 500,
            height: 300
        });
    } else if (info.menuItemId === "syncRealTokenFinary") {
        try {
            const walletAddress = "0x10df7dd932e655c01cc7a35ec23711b1d4153882";
            const realtSync = new RealTSync();
            const finaryClient = new FinaryClient();

            // Trouver l'onglet actif
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length === 0) {
                    console.error("Aucun onglet actif trouvé.");
                    return;
                }
                const tabId = tabs[0].id;
                // Injecter modal-progress.js dans l'onglet actif
                chrome.scripting.executeScript({
                    target: { tabId },
                    files: ["modal-progress.js"]
                }, async () => {
                    // Lancer la synchronisation et envoyer la progression à l'onglet
                    await realtSync.syncWalletWithFinary(walletAddress, finaryClient, (step, details) => {
                        chrome.tabs.sendMessage(tabId, {
                            type: "progress-modal",
                            data: {
                                title: "Synchronisation RealT",
                                status: details.message || details.status || step,
                                progress: details.progress,
                                log: details.log || details.tokenName || step
                            }
                        });
                    });
                });
            });
        } catch (error) {
            console.error('Sync error:', error);
        }
    } else if (info.menuItemId === "deleteAllRealTokenFinary") {
        try {
            const realtSync = new RealTSync();
            const finaryClient = new FinaryClient();
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length === 0) {
                    console.error("Aucun onglet actif trouvé.");
                    return;
                }
                const tabId = tabs[0].id;
                chrome.scripting.executeScript({
                    target: { tabId },
                    files: ["modal-progress.js"]
                }, async () => {
                    await realtSync.deleteAllFinaryRealTTokens(finaryClient, (step, details) => {
                        chrome.tabs.sendMessage(tabId, {
                            type: "progress-modal",
                            data: {
                                title: "Suppression des assets RealT",
                                status: details.message || details.status || step,
                                progress: details.progress,
                                log: details.log || details.tokenName || step
                            }
                        });
                    });
                });
            });
        } catch (error) {
            console.error('Delete error:', error);
        }
    }
}
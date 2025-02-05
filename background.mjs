import { handleMenuClick } from "./actions.js";

// Ajouter une entrée au menu contextuel lors de l'installation de l'extension
chrome.runtime.onInstalled.addListener(() => {
    console.log("🛠️ Extension installée, création des menus...");
    const menuItems = [
        { id: "showJsonTab_holdings", title: "Afficher JSON_holdings" },
        { id: "showAssetsSummary", title: "Voir résumé des assets" },
        { id: "addRealEstate", title: "Ajouter un bien immobilier" },
        { id: "showDisplayCurrencyCode", title: "Afficher la devise configurée" },
        { id: "showRealTTokens", title: "Afficher les RealT Tokens" },
        { id: "setRealTToken", title: "Configurer le token RealT" },
    ];
    
    menuItems.forEach(item => {
        chrome.contextMenus.create({
            id: item.id,
            title: item.title,
            contexts: ["all"]
        }, () => {
            if (chrome.runtime.lastError) {
                console.error(`❌ Erreur menu ${item.id}:`, chrome.runtime.lastError);
            } else {
                console.log(`✅ Menu ajouté: ${item.title}`);
            }
        });
    });
});

// Gérer les actions du menu contextuel
chrome.contextMenus.onClicked.addListener(handleMenuClick);
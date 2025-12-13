import { handleMenuClick } from './actions.js';

// Initialize context menus
const initializeMenus = () => {
    console.log("🛠️ Extension installée, création des menus...");
    const menuItems = [
        { id: "getHoldingsAccounts", title: "Télécharger tout le portefeuille" },
        { id: "exportFlattenedAssets", title: "Exporter assets aplatis (CSV)" },
        { id: "analyzeEtfOverlap", title: "Analyser l'overlap des ETFs" },
        { id: "setRealTWallet", title: "Paramêtre pour RealT" },
        { id: "syncRealTokenFinary", title: "Sync les RealToken sur Finary" },
        { id: "deleteAllRealTokenFinary", title: "Supprimer tous les RealToken de Finary"}
    ];
    
    menuItems.forEach(item => {
        chrome.contextMenus.create({
            id: item.id,
            title: item.title,
            contexts: ["all"]
        });
    });
};

// Initialize extension
chrome.runtime.onInstalled.addListener(initializeMenus);

// Handle menu clicks
chrome.contextMenus.onClicked.addListener(handleMenuClick);
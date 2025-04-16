import { handleMenuClick } from './actions.js';

// Initialize context menus
const initializeMenus = () => {
    console.log("🛠️ Extension installée, création des menus...");
    const menuItems = [
        //{ id: "showJsonTab_holdings", title: "Afficher JSON_holdings" },
        //{ id: "showAssetsSummary", title: "Voir résumé des assets" },
        { id: "setRealTToken", title: "Paramêtre pour RealT" },
        { id: "syncRealTokenFinary", title: "Sync les RealToken sur Finary" },
        {id: "deleteAllRealTokenFinary", title: "Supprimer tous les RealToken de Finary"}
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
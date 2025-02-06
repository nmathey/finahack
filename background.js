import { handleMenuClick } from './actions.js';

// Initialize context menus
const initializeMenus = () => {
    console.log("🛠️ Extension installée, création des menus...");
    const menuItems = [
        { id: "showJsonTab_holdings", title: "Afficher JSON_holdings" },
        { id: "showAssetsSummary", title: "Voir résumé des assets" },
        { id: "addRealEstate", title: "Ajouter un bien immobilier" },
        { id: "showDisplayCurrencyCode", title: "Afficher la devise configurée" },
        { id: "showRealTokenWallet", title: "Afficher les RealToken détenus" },
        { id: "setRealTToken", title: "Configurer le token RealT" },
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
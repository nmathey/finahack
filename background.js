// Ajouter une entrée au menu contextuel lors de l'installation de l'extension
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "showJsonTab_me",
        title: "Afficher JSON_me",
        contexts: ["all"]
    });
    chrome.contextMenus.create({
        id: "showJsonTab_holdings",
        title: "Afficher JSON_holdings",
        contexts: ["all"]
    });
    chrome.contextMenus.create({
        id: "showAssetsSummary",
        title: "Voir résumé des assets",
        contexts: ["all"]
    });
	chrome.contextMenus.create({
        id: "myPyramid",
        title: "Voir ma pyramide",
        contexts: ["all"]
    });
	chrome.contextMenus.create({
    id: "addRealEstate",
    title: "Ajouter un bien immobilier",
    contexts: ["all"]
});

});

// Gérer les actions du menu contextuel
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "showJsonTab_me") {
        chrome.storage.local.get('me', (result) => {
            if (result.me) {
                chrome.tabs.create({ url: chrome.runtime.getURL("json_viewer_me.html") });
            } else {
                console.error("Pas de données JSON disponibles dans chrome.storage.");
            }
        });
    } else if (info.menuItemId === "showJsonTab_holdings") {
        chrome.storage.local.get('holdings', (result) => {
            if (result.holdings) {
                chrome.tabs.create({ url: chrome.runtime.getURL("json_viewer_holdings.html") });
            } else {
                console.error("Pas de données JSON disponibles dans chrome.storage.");
            }
        });
    } else if (info.menuItemId === "showAssetsSummary") {
        console.log("✅ Clic détecté sur 'Voir résumé des assets'");
        
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length === 0) {
                console.error("❌ Aucun onglet actif trouvé.");
                return;
            }
            
            // D'abord injecter le script
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                files: ["consolidateAssets.js"]
            }, () => {
                if (chrome.runtime.lastError) {
                    console.error("❌ Erreur lors de l'injection du script:", chrome.runtime.lastError);
                } else {
                    console.log("✅ Script injecté avec succès.");
                    // Envoyer un message pour déclencher la fonction après l'injection
                    chrome.tabs.sendMessage(tabs[0].id, { action: "openAssetsModal" });
                }
            });
        });
    } else if (info.menuItemId === "myPyramid") {
        console.log("✅ Clic détecté sur 'Voir ma pyramide'");
        
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length === 0) {
                console.error("❌ Aucun onglet actif trouvé.");
                return;
            }
            
            // D'abord injecter le script
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                files: ["myPyramid.js"]
            }, () => {
                if (chrome.runtime.lastError) {
                    console.error("❌ Erreur lors de l'injection du script:", chrome.runtime.lastError);
                } else {
                    console.log("✅ Script injecté avec succès.");
                    // Envoyer un message pour déclencher la fonction après l'injection
                    chrome.tabs.sendMessage(tabs[0].id, { action: "openAssetsModal" });
                }
            });
        });
    } else if (info.menuItemId === "addRealEstate") {
        chrome.tabs.sendMessage(tab.id, { action: "openRealEstateForm" });
    }
});
// Créer un élément de menu contextuel lors de l'installation de l'extension
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
});

// Écouter l'événement de clic sur le menu contextuel
chrome.contextMenus.onClicked.addListener((info, tab) => {
	if (info.menuItemId === "showJsonTab_me") {
	  	// Vérifier que les données JSON sont bien présentes dans chrome.storage
		chrome.storage.local.get('me', (result) => {
			const jsonData = result.me;

			if (jsonData) {
		  	// Si les données JSON existent, ouvrir un nouvel onglet
				chrome.tabs.create({
					url: chrome.runtime.getURL("json_viewer_me.html")
				});
			} else {
		  	console.error("Pas de données JSON disponibles dans chrome.storage.");
			}
	  	});
	} else {
		if (info.menuItemId === "showJsonTab_holdings") {
			// Vérifier que les données JSON sont bien présentes dans chrome.storage
			chrome.storage.local.get('holdings', (result) => {
			const jsonData = result.holdings;
		
			if (jsonData) {
				// Si les données JSON existent, ouvrir un nouvel onglet
				chrome.tabs.create({
				url: chrome.runtime.getURL("json_viewer_holdings.html")
				});
			} else {
				console.error("Pas de données JSON disponibles dans chrome.storage.");
			}
			});
		}
	}
  });
  
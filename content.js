// Function to inject a script into the page
function injectScript(file, node) {
  var th = document.getElementsByTagName(node)[0];
  var script = document.createElement('script');
  script.setAttribute('type', 'text/javascript');
  script.setAttribute('src', chrome.runtime.getURL(file));
  th.appendChild(script);
}

// Inject the script that will run in the page context
injectScript('injected.js', 'body');

// Function to fetch JSON data from an API
async function fetchData(apiUrl, token, route) {
  try {
      const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
          }
      });
      const data = await response.json();
      // Stocker les données JSON dans le chrome.storage
      chrome.storage.local.set({ [route]: data }, function() {
          console.log('JSON stocké dans chrome.storage:', data);
      });
  } catch (error) {
      console.error('Erreur lors de la récupération des données API:', error);
  }
}

// construction AssetsList
function extractAssets() {
  chrome.storage.local.get('holdings', function(result) {
      const jsonData = result.holdings;
      console.log("Données JSON récupérées :", jsonData);

      if (!jsonData || !jsonData.result || jsonData.result.length === 0) {
          console.warn("Aucune donnée trouvée dans result");
          return;
      }

      const assetsList = []; // Correction : Initialisation de assetsList

      jsonData.result.forEach(envelope => {
          console.log("📦 Traitement de l'enveloppe :", envelope);

          const categoryMapping = [
              { key: "real_estates", category: "Real Estates", filter: asset => asset.category === "rent", name: () => envelope.name, value: asset => asset.display_current_value },
              { key: "scpis", category: "SCPI", filter: () => true, name: asset => asset.scpi?.name, value: asset => asset.display_current_value },
              { key: "fiats", category: "LIVRETS", filter: () => envelope.bank_account_type?.name === "savings", name: () => envelope.name, value: asset => asset.display_current_value },
              { key: "securities", category: "CTO", filter: () => envelope.bank_account_type?.name === "brokerage", name: asset => asset.security?.name, value: asset => asset.display_current_value },
              { key: "cryptos", category: "CRYPTO", filter: () => true, name: asset => asset.crypto?.code, value: asset => asset.display_current_value },
              { key: "fonds_euro", category: "AV", filter: () => envelope.bank_account_type?.name === "lifeinsurance", name: asset => asset.name, value: asset => asset.display_current_value },
              { key: "securities", category: "AV", filter: () => envelope.bank_account_type?.name === "lifeinsurance", name: asset => asset.security?.name, value: asset => asset.display_current_value },
              { key: "startups", category: "STARTUPS", filter: () => true, name: asset => asset.startup?.name, value: asset => asset.display_current_value }
          ];

          categoryMapping.forEach(({ key, category, filter, name, value }) => {
              if (envelope[key] && Array.isArray(envelope[key]) && envelope[key].length > 0) {
                  envelope[key].forEach(asset => {
                      if (filter(asset)) {
                          const assetName = typeof name === "function" ? name(asset) : name;
                          const assetValue = typeof value === "function" ? value(asset) : value;
                          if (assetName && assetValue !== undefined) {
                              assetsList.push({ category, name: assetName, value: assetValue });
                          }
                      }
                  });
              }
          });
      });

      // Stocker assetsList dans chrome.storage.local
      chrome.storage.local.set({ parsedAssets: assetsList }, () => {
          console.log("✅ Assets stockés dans chrome.storage.local :", assetsList);
      });
  });
}

let sessionToken = null; // Déclaration de la variable globale

// Listen for the message from the injected script
window.addEventListener('message', function(event) {
    // We only accept messages from our own page
    if (event.source !== window) return;

    if (event.data.type && event.data.type === 'FROM_PAGE') {
        // Now we have the session token
        sessionToken = event.data.token; // Stocker le token globalement
        console.log("✅ Token reçu:", sessionToken);

        // Stocker le token dans chrome.storage
        chrome.storage.local.set({ sessionToken: sessionToken }, () => {
            console.log("✅ Token stocké dans chrome.storage.local");
        });

        // Call your API using the session token
        /*const apiUrl_me = 'https://api.finary.com/users/me';
        fetchData(apiUrl_me, sessionToken, "me");
        const apiUrl_holdings = 'https://api.finary.com/organizations/7422e38a-2fc5-4115-9691-516de6fba200/memberships/35cb45e6-68b0-4d3c-a0d1-f304ce11eb59/holdings_accounts';
        fetchData(apiUrl_holdings, sessionToken, "holdings").then(() => {
            extractAssets();
        }).catch(error => console.error("❌ Erreur lors de l'extraction des assets :", error));
      */
    }
});

let messageListener = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "REQUEST_TOKEN") {
        console.log("🔄 Demande de nouveau token reçue");
        
        // Supprimer l'ancien listener s'il existe
        if (messageListener) {
            window.removeEventListener("message", messageListener);
        }

        // Créer le nouveau listener
        messageListener = function(event) {
            if (event.source !== window) return;
            if (event.data.type && event.data.type === "FROM_PAGE") {
                console.log("Token reçu de injected.js:", event.data.token);
                sendResponse({ token: event.data.token });
                // Nettoyage après réponse
                window.removeEventListener("message", messageListener);
                messageListener = null;
            }
        };

        // Ajouter le nouveau listener
        window.addEventListener("message", messageListener);

        // Demander un nouveau token à injected.js
        window.postMessage({ type: "REQUEST_NEW_TOKEN" }, "*");
        
        return true; // Important pour les réponses asynchrones
    }
});

/* chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "openRealEstateForm") {
        if (!sessionToken) {
            console.error("❌ Erreur: sessionToken est indéfini !");
            return;
        }

        const userData = {
            sessionToken: sessionToken,
            category: "rent",
            address: "123 rue Exemple, Paris",
            user_estimated_value: 300000,
            description: "Appartement en location",
            surface: 50,
            buying_price: 250000,
            building_type: "apartment",
            ownership_percentage: 100,
            monthly_charges: 150,
            monthly_rent: 1200,
            yearly_taxes: 1000,
            rental_period: "annual",
            rental_type: "nue",
            place_id: "ChIJF2Cu_iDm9EcREgxjJap4mCM"
        };

        import(chrome.runtime.getURL('add_real_estate.js'))
            .then(module => {
                console.log("✅ Module chargé :", module);
                return module.addUserRealEstate(userData);
            })
            .then(response => console.log("✅ Réponse API :", response))
            .catch(error => console.error("❌ Erreur API :", error));
    }
});
*/



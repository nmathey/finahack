// Global state
let sessionToken = null;
let messageListener = null;

// Initialize extension
function initializeExtension() {
  // Inject the script that will run in the page context
  injectScript('injected.js', 'body');
  
  // Set up message listeners
  setupEventListeners();
}

// Function to inject a script into the page
function injectScript(file, node) {
  const target = document.getElementsByTagName(node)[0];
  if (!target) {
    console.error(`Target node ${node} not found`);
    return;
  }
  
  const script = document.createElement('script');
  script.setAttribute('type', 'text/javascript');
  script.setAttribute('src', chrome.runtime.getURL(file));
  target.appendChild(script);
}

// Set up all event listeners
function setupEventListeners() {
  // Listen for messages from injected script
  window.addEventListener('message', handleWindowMessages);
  
  // Listen for messages from extension
  chrome.runtime.onMessage.addListener(handleRuntimeMessages);
  
  // Listen for progress modal messages
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "progress-modal") {
        if (typeof window.injectProgressModal === "function" && typeof window.updateProgressModal === "function") {
            window.injectProgressModal();
            window.updateProgressModal(msg.data);
        }
    }
  });
}

// Handle messages from the injected script
function handleWindowMessages(event) {
  // We only accept messages from our own page
  if (event.source !== window) return;

  if (event.data.type && event.data.type === 'FROM_PAGE') {
    // Store the session token
    sessionToken = event.data.token;
    console.log("✅ Token reçu:", sessionToken);

    // Store token in chrome.storage
    chrome.storage.local.set({ sessionToken }, () => {
      console.log("✅ Token stocké dans chrome.storage.local");
    });

    // You can uncomment these to fetch data when token is received
    /*
    fetchData('https://api.finary.com/users/me', sessionToken, "me");
    fetchData(
      'https://api.finary.com/organizations/7422e38a-2fc5-4115-9691-516de6fba200/memberships/35cb45e6-68b0-4d3c-a0d1-f304ce11eb59/holdings_accounts', 
      sessionToken, 
      "holdings"
    ).then(() => {
      extractAssets();
    }).catch(error => console.error("❌ Erreur lors de l'extraction des assets :", error));
    */
  }
}

// Handle messages from the extension
function handleRuntimeMessages(message, sender, sendResponse) {
  // Handle token requests
  if (message.action === "REQUEST_TOKEN") {
    console.log("🔄 Demande de nouveau token reçue");
    requestNewToken(sendResponse);
    return true; // Important for async responses
  }
  
  // Handle real estate form requests
  if (message.action === "openRealEstateForm") {
    handleRealEstateForm();
  }
}

// Request a new token from the injected script
function requestNewToken(sendResponse) {
  // Remove old listener if it exists
  if (messageListener) {
    window.removeEventListener("message", messageListener);
  }

  // Create new listener
  messageListener = function(event) {
    if (event.source !== window) return;
    if (event.data.type && event.data.type === "FROM_PAGE") {
      console.log("Token reçu de injected.js:", event.data.token);
      sendResponse({ token: event.data.token });
      // Clean up after response
      window.removeEventListener("message", messageListener);
      messageListener = null;
    }
  };

  // Add new listener
  window.addEventListener("message", messageListener);

  // Request new token from injected.js
  window.postMessage({ type: "REQUEST_NEW_TOKEN" }, "*");
}

// Function to fetch JSON data from an API
async function fetchData(apiUrl, token, route) {
  if (!token) {
    throw new Error('No token provided for API request');
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Store JSON data in chrome.storage
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [route]: data }, function() {
        console.log(`JSON stocké dans chrome.storage (${route}):`, data);
        resolve(data);
      });
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des données API:', error);
    throw error; // Re-throw to allow caller to handle
  }
}

// Extract and organize assets from holdings data
function extractAssets() {
  chrome.storage.local.get('holdings', function(result) {
    const jsonData = result.holdings;
    console.log("Données JSON récupérées :", jsonData);

    if (!jsonData?.result?.length) {
      console.warn("Aucune donnée trouvée dans result");
      return;
    }

    const assetsList = [];
    
    // Define category mappers - each returns an array of assets
    const categoryMappers = [
      // Real Estate
      envelope => (envelope.real_estates || [])
        .filter(asset => asset.category === "rent")
        .map(asset => ({
          category: "Real Estates",
          name: envelope.name,
          value: asset.display_current_value
        })),
      
      // SCPI
      envelope => (envelope.scpis || [])
        .map(asset => ({
          category: "SCPI",
          name: asset.scpi?.name,
          value: asset.display_current_value
        })),
      
      // Livrets
      envelope => envelope.bank_account_type?.name === "savings" ? 
        (envelope.fiats || []).map(asset => ({
          category: "LIVRETS",
          name: envelope.name,
          value: asset.display_current_value
        })) : [],
      
      // CTO
      envelope => envelope.bank_account_type?.name === "brokerage" ?
        (envelope.securities || []).map(asset => ({
          category: "CTO",
          name: asset.security?.name,
          value: asset.display_current_value
        })) : [],
      
      // Crypto
      envelope => (envelope.cryptos || [])
        .map(asset => ({
          category: "CRYPTO",
          name: asset.crypto?.code,
          value: asset.display_current_value
        })),
      
      // AV - Fonds Euro
      envelope => envelope.bank_account_type?.name === "lifeinsurance" ?
        (envelope.fonds_euro || []).map(asset => ({
          category: "AV",
          name: asset.name,
          value: asset.display_current_value
        })) : [],
      
      // AV - Securities
      envelope => envelope.bank_account_type?.name === "lifeinsurance" ?
        (envelope.securities || []).map(asset => ({
          category: "AV",
          name: asset.security?.name,
          value: asset.display_current_value
        })) : [],
      
      // Startups
      envelope => (envelope.startups || [])
        .map(asset => ({
          category: "STARTUPS",
          name: asset.startup?.name,
          value: asset.display_current_value
        }))
    ];

    // Process each envelope with all mappers
    jsonData.result.forEach(envelope => {
      console.log("📦 Traitement de l'enveloppe :", envelope);
      
      // Apply all mappers to the envelope
      categoryMappers.forEach(mapper => {
        const mappedAssets = mapper(envelope);
        
        // Add valid assets to the list
        mappedAssets.forEach(asset => {
          if (asset.name && asset.value !== undefined) {
            assetsList.push(asset);
          }
        });
      });
    });

    // Store assetsList in chrome.storage.local
    chrome.storage.local.set({ parsedAssets: assetsList }, () => {
      console.log("✅ Assets stockés dans chrome.storage.local :", assetsList);
    });
  });
}

// Handle real estate form request
function handleRealEstateForm() {
  if (!sessionToken) {
    console.error("❌ Erreur: sessionToken est indéfini !");
    return;
  }

  const userData = {
    sessionToken: sessionToken,
    category: "rent",
    address: "123 rue Exemple, Paris",
    user_estimated_value: 1,
    description: "RealT - Test - Appartement en location",
    surface: 50,
    buying_price: 1,
    building_type: "apartment",
    ownership_percentage: 100,
    monthly_charges: 150,
    monthly_rent: 1200,
    yearly_taxes: 1000,
    rental_period: "annual",
    rental_type: "nue",
    place_id: "EjY5ODAgTiBGZWRlcmFsIEh3eSBzdWl0ZSAxMTAsIEJvY2EgUmF0b24sIEZMIDMzNDMyLCBVU0EiJRojChYKFAoSCZdwCUH24diIER1Jcn6F7iQtEglzdWl0ZSAxMTA"
  };

  import(chrome.runtime.getURL('add_real_estate.js'))
    .then(module => {
      console.log("✅ Module chargé :", module);
      return module.addUserRealEstate(userData);
    })
    .then(response => console.log("✅ Réponse API :", response))
    .catch(error => console.error("❌ Erreur API :", error));
}

// Initialize the extension when the script loads
initializeExtension();
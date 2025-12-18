const injectScript = (file, node) => {
  const target = document.getElementsByTagName(node)[0];
  if (!target) {
    console.error(`Target node ${node} not found`);
    return;
  }
  const script = document.createElement('script');
  script.setAttribute('type', 'text/javascript');
  script.setAttribute('src', chrome.runtime.getURL(file));
  target.appendChild(script);
};

const handleWindowMessages = (event) => {
  if (event.source !== window || event.data.type !== 'FROM_PAGE') return;

  const { token } = event.data;
  console.log('✅ Token received:', token);
  chrome.storage.local.set({ sessionToken: token }, () => {
    console.log('✅ Token stored in chrome.storage.local');
  });
};

const handleRuntimeMessages = (message, sender, sendResponse) => {
  if (message.action === 'REQUEST_TOKEN') {
    console.log('🔄 New token request received');
    const listener = (event) => {
      if (event.source !== window || event.data.type !== 'FROM_PAGE') return;
      console.log('Token received from injected.js:', event.data.token);
      sendResponse({ token: event.data.token });
      window.removeEventListener('message', listener);
    };
    window.addEventListener('message', listener);
    window.postMessage({ type: 'REQUEST_NEW_TOKEN' }, '*');
    return true;
  }

  if (message.action === 'openRealEstateForm') {
    chrome.storage.local.get('sessionToken', ({ sessionToken }) => {
      if (!sessionToken) {
        console.error('❌ Error: sessionToken is undefined!');
        return;
      }
      const userData = {
        sessionToken: sessionToken,
        category: 'rent',
        address: '123 rue Exemple, Paris',
        user_estimated_value: 1,
        description: 'RealT - Test - Appartement en location',
        surface: 50,
        buying_price: 1,
        building_type: 'apartment',
        ownership_percentage: 100,
        monthly_charges: 150,
        monthly_rent: 1200,
        yearly_taxes: 1000,
        rental_period: 'annual',
        rental_type: 'nue',
        place_id:
          'EjY5ODAgTiBGZWRlcmFsIEh3eSBzdWl0ZSAxMTAsIEJvY2EgUmF0b24sIEZMIDMzNDMyLCBVU0EiJRojChYKFAoSCZdwCUH24diIER1Jcn6F7iQtEglzdWl0ZSAxMTA',
      };
      import(chrome.runtime.getURL('src/add_real_estate.js'))
        .then((module) => module.addUserRealEstate(userData))
        .then((response) => console.log('✅ API Response:', response))
        .catch((error) => console.error('❌ API Error:', error));
    });
  }
};

const setupEventListeners = () => {
  window.addEventListener('message', handleWindowMessages);
  chrome.runtime.onMessage.addListener(handleRuntimeMessages);
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'progress-modal' && typeof window.injectProgressModal === 'function' && typeof window.updateProgressModal === 'function') {
      window.injectProgressModal();
      window.updateProgressModal(msg.data);
    }
  });
};

const initializeExtension = () => {
  injectScript('src/injected.js', 'body');
  setupEventListeners();
};

initializeExtension();

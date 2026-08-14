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

// keys used by the treemap injection feature
const INJECT_KEY = 'inject_treemap_into_synthese';
const FLATTENED_KEY = 'flattened_holdings_cache';
const LAST_SELECTION_KEY = 'popup_myasset_last_selection';
const TREEMAP_CONTAINER_ID = 'finaHack-treemap-container';

// debounce / throttling helpers to avoid excessive work on SPA mutations
let _lastCheckAt = 0;
let _checkScheduled = false;
const CHECK_DEBOUNCE_MS = 800;

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
    if (
      msg.type === 'progress-modal' &&
      typeof window.injectProgressModal === 'function' &&
      typeof window.updateProgressModal === 'function'
    ) {
      window.injectProgressModal();
      window.updateProgressModal(msg.data);
    }
  });
};

const initializeExtension = () => {
  injectScript('src/injected.js', 'body');
  // watch for Synthèse view and inject treemap when enabled
  watchAndInjectTreemap();
  setupEventListeners();
};

initializeExtension();

// --- Treemap injection logic ---

function isSyntheseView() {
  try {
    const path = window.location.pathname || '';
    if (path.toLowerCase().includes('synthese') || path.toLowerCase().includes('portfolio')) return true;
    const h1 = document.querySelector('h1');
    if (h1 && /synth[eè]se/i.test(h1.textContent)) return true;
    // fallback: look for menu item or tab labelled Synthèse
    const el = Array.from(document.querySelectorAll('*')).find((n) => /synth[eè]se/i.test(n.textContent || ''));
    return Boolean(el);
  } catch (e) {
    return false;
  }
}

function injectTreemapScriptsAndSend(items) {
  try {
    // if the page already has the treemap container, only send updated data
    if (document.getElementById(TREEMAP_CONTAINER_ID)) {
      window.postMessage({ type: 'FINAHACK_TREEMAP_DATA', items }, '*');
      return;
    }

    // inject Plotly if not already present in page
    const hasPlotly = Boolean(window.Plotly) || document.querySelector('script[src*="plotly.min.js"]');
    if (!hasPlotly) injectScript('lib/plotly.min.js', 'head');

    // inject the renderer script once
    if (!document.querySelector(`script[src*="page_treemap_inject.js"]`)) {
      injectScript('src/page_treemap_inject.js', 'body');
    }

    // send data after scripts had time to load; only once
    setTimeout(() => {
      window.postMessage({ type: 'FINAHACK_TREEMAP_DATA', items }, '*');
    }, 600);
  } catch (e) {
    console.error('injectTreemapScriptsAndSend failed', e);
  }
}

function checkAndMaybeInject() {
  // throttle repeated checks
  const now = Date.now();
  if (now - _lastCheckAt < CHECK_DEBOUNCE_MS) {
    if (!_checkScheduled) {
      _checkScheduled = true;
      setTimeout(() => {
        _checkScheduled = false;
        checkAndMaybeInject();
      }, CHECK_DEBOUNCE_MS);
    }
    return;
  }
  _lastCheckAt = now;

  chrome.storage.local.get([INJECT_KEY, FLATTENED_KEY, LAST_SELECTION_KEY], (res) => {
    const enabled = Boolean(res && res[INJECT_KEY]);
    showDebug(`inject enabled=${enabled}`);
    if (!enabled) return showDebug('injection disabled by toggle');
    if (!isSyntheseView()) return showDebug('Synthèse view not detected');

    const items = Array.isArray(res && res[FLATTENED_KEY]) ? res[FLATTENED_KEY] : [];
    const selectedIds = Array.isArray(res && res[LAST_SELECTION_KEY])
      ? res[LAST_SELECTION_KEY].map((id) => String(id).trim()).filter(Boolean)
      : [];

    const filteredItems = selectedIds.length > 0
      ? items.filter((it) => selectedIds.includes(String(it?.assetId || '').trim()))
      : items;

    showDebug(`found items=${items.length} filtered=${filteredItems.length} selected=${selectedIds.length}`);
    if (filteredItems && filteredItems.length > 0) {
      injectTreemapScriptsAndSend(filteredItems);
      showDebug('injected treemap scripts and sent data');
    } else {
      injectTreemapScriptsAndSend([]);
      showDebug('no data to render after selection filter');
    }
  });
}

function watchAndInjectTreemap() {
  // initial check
  checkAndMaybeInject();
  // observe navigation changes (SPA)
  const mo = new MutationObserver(() => {
    // debounce heavy checks triggered by frequent DOM mutations
    if (!_checkScheduled) {
      _checkScheduled = true;
      setTimeout(() => {
        _checkScheduled = false;
        checkAndMaybeInject();
      }, CHECK_DEBOUNCE_MS);
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });

  // also listen to storage changes to remove if disabled
  chrome.storage.onChanged.addListener((changes) => {
    if (changes[INJECT_KEY]) {
      const newVal = changes[INJECT_KEY].newValue;
      if (!newVal) {
        window.postMessage({ type: 'FINAHACK_TREEMAP_REMOVE' }, '*');
      } else {
        checkAndMaybeInject();
      }
    }
    if (changes[FLATTENED_KEY] || changes[LAST_SELECTION_KEY]) {
      // if the cached data or popup selection changed and injection is enabled, resend
      checkAndMaybeInject();
    }
  });
}

function showDebug(msg) {
  try {
    const id = 'finaHack-debug-overlay';
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      el.style.position = 'fixed';
      el.style.left = '12px';
      el.style.bottom = '12px';
      el.style.zIndex = 2147483647;
      el.style.background = 'rgba(0,0,0,0.75)';
      el.style.color = '#fff';
      el.style.padding = '8px 10px';
      el.style.borderRadius = '8px';
      el.style.fontSize = '12px';
      el.style.maxWidth = '320px';
      el.style.boxShadow = '0 6px 18px rgba(0,0,0,0.3)';
      document.documentElement.appendChild(el);
    }
    el.textContent = `[FinaHack] ${msg}`;
    // auto-hide after 6s
    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(() => {
      try {
        el.remove();
      } catch (e) {}
    }, 6000);
  } catch (e) {
    console.log('[FinaHack debug]', msg);
  }
}

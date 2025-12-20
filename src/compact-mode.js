// FinaHack - Compact Mode Feature

const COMPACT_MODE_STORAGE_KEY = 'finaHackCompactMode';
let isCompactMode = false;

// Function to toggle compact mode
const toggleCompactMode = () => {
  isCompactMode = !isCompactMode;
  document.body.classList.toggle('compact-mode', isCompactMode);

  // Save preference to chrome.storage.local
  chrome.storage.local.set({ [COMPACT_MODE_STORAGE_KEY]: isCompactMode });
};

// Function to create the compact mode button
const createCompactModeButton = () => {
  const button = document.createElement('button');
  button.textContent = 'Compact Mode';
  button.style.position = 'fixed';
  button.style.bottom = '20px';
  button.style.right = '20px';
  button.style.zIndex = '1000';
  button.style.backgroundColor = '#007bff';
  button.style.color = 'white';
  button.style.border = 'none';
  button.style.padding = '10px 15px';
  button.style.borderRadius = '5px';
  button.style.cursor = 'pointer';

  button.addEventListener('click', toggleCompactMode);

  return button;
};

// Function to initialize the compact mode feature
const initCompactMode = () => {
  // Load user preference from chrome.storage.local
  chrome.storage.local.get([COMPACT_MODE_STORAGE_KEY], (result) => {
    isCompactMode = result[COMPACT_MODE_STORAGE_KEY] || false;
    if (isCompactMode) {
      document.body.classList.add('compact-mode');
    }
  });

  // Inject the button into the UI
  const button = createCompactModeButton();
  document.body.appendChild(button);

  // Inject the CSS file
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.type = 'text/css';
  link.href = chrome.runtime.getURL('src/compact-mode.css');
  document.head.appendChild(link);
};

// Export the init function
window.initCompactMode = initCompactMode;

// Maximum retry attempts and delay between retries
const MAX_RETRY_ATTEMPTS = 20;
const RETRY_DELAY_MS = 500;
let retryCount = 0;

// Entry point - start the script
function initialize() {
  console.log('Injected script running');
  setupEventListeners();
  checkForClerkSession();
}

// Set up event listeners
function setupEventListeners() {
  // Listen for messages from the content script
  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    
    if (event.data.type && event.data.type === 'REQUEST_NEW_TOKEN') {
      console.log("Message reçu de content.js pour demander un nouveau token");
      checkForClerkSession();
    }
  });
}

// Function to check for Clerk availability and session
async function checkForClerkSession() {
  if (window.Clerk && window.Clerk.session) {
    try {
      const sessionToken = await window.Clerk.session.getToken();
      if (sessionToken) {
        console.log('Clerk session token obtained successfully');
        
        // Send the session token back to the content script
        window.postMessage({ 
          type: 'FROM_PAGE', 
          token: sessionToken 
        }, '*');
        
        // Reset retry counter on success
        retryCount = 0;
        return;
      } else {
        console.warn('Clerk token is null or empty');
      }
    } catch (error) {
      console.error('Error getting the session token:', error);
    }
  }
  
  // If we reach here, retry is needed
  retryCount++;
  
  if (retryCount <= MAX_RETRY_ATTEMPTS) {
    console.log(`Clerk not ready. Retry attempt ${retryCount}/${MAX_RETRY_ATTEMPTS}...`);
    setTimeout(checkForClerkSession, RETRY_DELAY_MS);
  } else {
    console.error(`Failed to get Clerk session after ${MAX_RETRY_ATTEMPTS} attempts`);
    
    // Notify content script about failure
    window.postMessage({ 
      type: 'FROM_PAGE_ERROR', 
      error: 'Failed to obtain Clerk session token after maximum retries' 
    }, '*');
  }
}

// Start the script
initialize();
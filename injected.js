// Function to check for Clerk availability and session
async function checkForClerkSession() {
  if (window.Clerk && window.Clerk.session) {
      try {
          const sessionToken = await window.Clerk.session.getToken(); // Await the token
          // Send the session token back to the content script
          console.log('Clerk is OK');
          window.postMessage({ type: 'FROM_PAGE', token: sessionToken }, '*');
      } catch (error) {
          console.error('Error getting the session token:', error);
      }
  } else {
      console.log('Clerk is not available or session is undefined. Retrying...');
      
      // Retry after 500ms
      setTimeout(checkForClerkSession, 500);
  }
}

console.log('Injected script running');
checkForClerkSession();

// Listen for messages from the content script to request a new token
window.addEventListener('message', function(event) {
  if (event.source !== window) return;
  if (event.data.type && event.data.type === 'REQUEST_NEW_TOKEN') {
      console.log("Message reçu de content.js pour demander un nouveau token");
      checkForClerkSession();
  }
});
document.addEventListener('DOMContentLoaded', function () {
    const jsonContent = document.getElementById('json-content');
  
    // Récupérer les données stockées dans chrome.storage
    chrome.storage.local.get('me', function(result) {
      const jsonData = result.me;
  
      if (jsonData) {
        // Afficher les données formatées dans le <pre>
        jsonContent.textContent = JSON.stringify(jsonData, null, 2);
      } else {
        jsonContent.textContent = 'Aucune donnée JSON disponible.';
      }
    });
  });  
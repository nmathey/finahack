// Afficher le token existant s'il est déjà enregistré
chrome.storage.local.get('realtToken', (result) => {
    if (result.realtToken) {
        document.getElementById('tokenInput').value = result.realtToken;
    }
});

document.getElementById('saveButton').addEventListener('click', () => {
    const token = document.getElementById('tokenInput').value;
    if (token) {
        chrome.storage.local.set({ 'realtToken': token }, () => {
            chrome.notifications.create({
                type: "basic",
                iconUrl: "extension_icon128.png",
                title: "Token RealT",
                message: "Token RealT sauvegardé avec succès"
            });
            window.close();
        });
    }
});

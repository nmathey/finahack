/**
 * Affiche le token RealT déjà enregistré dans le champ de saisie si présent dans chrome.storage.local.
 */
chrome.storage.local.get('realtToken', (result) => {
    if (result.realtToken) {
        document.getElementById('tokenInput').value = result.realtToken;
    }
});

/**
 * Gère le clic sur le bouton de sauvegarde du token RealT.
 * Si un token est saisi, il est enregistré dans chrome.storage.local et une notification s'affiche.
 */
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

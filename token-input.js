/**
 * Affiche le token RealT déjà enregistré dans le champ de saisie si présent dans chrome.storage.local.
 * Affiche aussi les adresses de wallet enregistrées si présentes.
 */
chrome.storage.local.get(['realtToken', 'realTwalletAddresses'], (result) => {
    if (result.realtToken) {
        document.getElementById('tokenInput').value = result.realtToken;
    }
    if (result.realTwalletAddresses && Array.isArray(result.realTwalletAddresses)) {
        document.getElementById('walletAddresses').value = result.realTwalletAddresses.join('\n');
    }
});

/**
 * Gère le clic sur le bouton de sauvegarde du token RealT et des adresses de wallet.
 * Si un token est saisi, il est enregistré dans chrome.storage.local.
 * Les adresses de wallet sont enregistrées sous forme de tableau (une adresse par ligne).
 */
document.getElementById('saveButton').addEventListener('click', () => {
    const token = document.getElementById('tokenInput').value;
    const walletAddressesRaw = document.getElementById('walletAddresses').value;
    const walletAddresses = walletAddressesRaw
        .split('\n')
        .map(addr => addr.trim())
        .filter(addr => addr.length > 0);

    const toSave = {};
    if (token) toSave['realtToken'] = token;
    toSave['realTwalletAddresses'] = walletAddresses;

    chrome.storage.local.set(toSave, () => {
        chrome.notifications.create({
            type: "basic",
            iconUrl: "extension_icon128.png",
            title: "Configuration RealT",
            message: "Configuration sauvegardée avec succès"
        });
        window.close();
    });
});
/**
 * Affiche les adresses de wallet enregistrées si présentes dans chrome.storage.local.
 */
chrome.storage.local.get(['realTwalletAddresses'], (result) => {
    if (result.realTwalletAddresses && Array.isArray(result.realTwalletAddresses)) {
        document.getElementById('walletAddresses').value = result.realTwalletAddresses.join('\n');
    }
});

/**
 * Les adresses de wallet sont enregistrées sous forme de tableau (une adresse par ligne).
 */
document.getElementById('saveButton').addEventListener('click', () => {
    const walletAddressesRaw = document.getElementById('walletAddresses').value;
    const walletAddresses = walletAddressesRaw
        .split('\n')
        .map(addr => addr.trim())
        .filter(addr => addr.length > 0);

    const toSave = {};
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
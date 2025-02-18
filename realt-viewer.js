document.addEventListener('DOMContentLoaded', () => {
    const jsonElement = document.getElementById('json');
    const loadingElement = document.getElementById('loading');
    const errorElement = document.getElementById('error');

    console.log('DOM loaded, fetching wallet data...');

    const syntaxHighlight = (json) => {
        if (typeof json !== 'string') {
            json = JSON.stringify(json, null, 2);
        }
        return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
            let cls = 'number';
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = 'key';
                } else {
                    cls = 'string';
                }
            } else if (/true|false/.test(match)) {
                cls = 'boolean';
            } else if (/null/.test(match)) {
                cls = 'null';
            }
            return '<span class="' + cls + '">' + match + '</span>';
        });
    };

    // Get all storage data for debugging
    chrome.storage.local.get(null, (all) => {
        console.log('All storage data:', all);
    });

    chrome.storage.local.get(['FinaryRealTokens'], function(data) {
        console.log("Raw data:", data);
        loadingElement.style.display = 'none';

        if (chrome.runtime.lastError) {
            console.error('Storage error:', chrome.runtime.lastError);
            errorElement.textContent = `Erreur: ${chrome.runtime.lastError.message}`;
            errorElement.style.display = 'block';
            return;
        }

        if (!data || !data.FinaryRealTokens) {
            console.error('No wallet tokens found');
            errorElement.textContent = 'Aucun token RealT trouvé';
            errorElement.style.display = 'block';
            return;
        }

        const formattedTokens = data.FinaryRealTokens.map(token => ({
            nom: token.tokenDetails?.fullName || token.tokenName,
            symbole: token.tokenDetails?.symbol || token.tokenSymbol,
            balance: token.balance,
            adresseContrat: token.contractAddress,
            details: token.tokenDetails || {}
        }));

        console.log('Formatted tokens:', formattedTokens);
        jsonElement.innerHTML = syntaxHighlight(JSON.stringify(formattedTokens, null, 2));
    });
});
document.addEventListener('DOMContentLoaded', () => {
    const jsonElement = document.getElementById('json');
    const loadingElement = document.getElementById('loading');
    const errorElement = document.getElementById('error');

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

    chrome.storage.local.get(['realtTokens', 'realtTokensTimestamp'], function(data) {
        console.log("Data from storage:", data);
        loadingElement.style.display = 'none';

        if (chrome.runtime.lastError) {
            console.error('Storage error:', chrome.runtime.lastError);
            errorElement.textContent = `Erreur: ${chrome.runtime.lastError.message}`;
            errorElement.style.display = 'block';
            return;
        }

        if (!data || !data.realtTokens) {
            console.error('No tokens found');
            errorElement.textContent = 'Aucun token trouvé dans le storage';
            errorElement.style.display = 'block';
            return;
        }

        if (data.realtTokensTimestamp) {
            const date = new Date(data.realtTokensTimestamp);
            console.log("Tokens last updated:", date.toLocaleString());
        }

        jsonElement.innerHTML = syntaxHighlight(data.realtTokens);
    });
});
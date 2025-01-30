document.addEventListener('DOMContentLoaded', function () {
    const assetsContainer = document.getElementById('assets-container');

    // Vérification que l'élément HTML existe bien
    if (!assetsContainer) {
        console.error("Erreur : L'élément #assets-container est introuvable.");
        return;
    }

    // Récupérer les données stockées dans chrome.storage
    chrome.storage.local.get("parsedAssets", function(result) {
        const assetsList = result.parsedAssets || [];

        console.log("📥 Assets récupérés depuis chrome.storage.local :", assetsList);

        if (assetsList.length === 0) {
            container.innerHTML = "<p>Aucun asset à afficher.</p>";
            return;
        }

        // Affichage des assets
                    assetsList.forEach(asset => {
                        const assetDiv = document.createElement("div");
                        assetDiv.classList.add("asset");
                        assetDiv.innerHTML = `
                            <h3>${asset.name}</h3>
                            <p><strong>Catégorie :</strong> ${asset.category}</p>
                            <p><strong>Valeur :</strong> ${asset.value}</p>
                        `;
                        assetsContainer.appendChild(assetDiv);
                    });
                })
                .catch(error => console.error("Erreur de chargement des assets :", error));
        });
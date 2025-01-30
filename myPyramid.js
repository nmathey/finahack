(() => {
    console.log("📌 Script myPyramid.js exécuté !");

    if (document.getElementById('modalPyramid')) {
        console.warn("⚠️ La modal existe déjà, affichage direct.");
        document.getElementById('modalPyramid').style.display = "flex";
        return;
    }

    const assets = {
        livrets: 40000,
        immobilier: 25000,
        actions: 25000,
        crypto: 15000,
        exotique: 5000
    };

    const totalAssets = Object.values(assets).reduce((acc, val) => acc + val, 0);

    const proportions = {};
    for (const key in assets) {
        proportions[key] = ((assets[key] / totalAssets) * 100).toFixed(1); // En pourcentage
    }

    const modal = document.createElement('div');
    modal.id = 'modalPyramid';
    modal.classList.add('modal');

    const modalContent = document.createElement('div');
    modalContent.classList.add('modal-content');

    const closeButton = document.createElement('span');
    closeButton.classList.add('close-button');
    closeButton.innerHTML = '&times;';

    const title = document.createElement('h2');
    title.innerText = "Répartition des actifs";

    const pyramidContainer = document.createElement('div');
    pyramidContainer.id = 'pyramidContainer';

    modalContent.appendChild(closeButton);
    modalContent.appendChild(title);
    modalContent.appendChild(pyramidContainer);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    const style = document.createElement('style');
    style.innerHTML = `
    .modal {
        display: flex;
        position: fixed;
        z-index: 1000;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.9);
        align-items: center;
        justify-content: center;
    }

    .modal-content {
        background-color: #1e1e1e;
        padding: 20px;
        border-radius: 10px;
        width: 50%;
        text-align: center;
        position: relative;
        color: white;
    }

    .close-button {
        position: absolute;
        top: 10px;
        right: 15px;
        font-size: 24px;
        cursor: pointer;
    }

    #pyramidContainer {
        width: 280px;
        height: 380px;
        position: relative;
        margin: auto;
    }

    .layer {
        position: absolute;
        left: 0;
        right: 0;
        height: 100%;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: bold;
        color: white;
        text-align: center;
    }

    /* Base Livrets */
    .layer-livrets {
        background-color: #6366f1;
        clip-path: polygon(0% 100%, 100% 100%, 85% 80%, 15% 80%);
    }

    /* Niveau Actions & Immobilier inversés */
    .layer-actions {
        background-color: #4ade80;
        clip-path: polygon(15% 80%, 50% 80%, 35% 60%, 15% 60%);
    }

    .layer-immobilier {
        background-color: #facc15;
        clip-path: polygon(50% 80%, 85% 80%, 85% 60%, 65% 60%);
    }

    /* Niveau Crypto */
    .layer-crypto {
        background-color: #f97316;
        clip-path: polygon(35% 60%, 65% 60%, 55% 40%, 45% 40%);
    }

    /* Sommet Exotique */
    .layer-exotique {
        background-color: #f87171;
        clip-path: polygon(45% 40%, 55% 40%, 50% 20%);
    }
    `;
    document.head.appendChild(style);

    function createPyramid() {
        console.log("✅ Génération de la pyramide...");
        pyramidContainer.innerHTML = "";

        const levels = ["livrets", "actions", "immobilier", "crypto", "exotique"];

        levels.forEach(level => {
            const layer = document.createElement('div');
            layer.classList.add('layer', `layer-${level}`);
            layer.innerHTML = `${level.toUpperCase()}<br>${proportions[level]}%`;

            layer.style.height = `${proportions[level] * 3}px`;

            pyramidContainer.appendChild(layer);
        });

        console.log("✅ Pyramide affichée !");
    }

    closeButton.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    createPyramid();
})();

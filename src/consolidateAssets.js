function consolidateAssets() {
  chrome.storage.local.get('parsedAssets', function (result) {
    const assetsList = result.parsedAssets || [];

    if (assetsList.length === 0) {
      alert('Aucun asset disponible.');
      return;
    }

    // Regroupement des valeurs par catégorie
    const categoryTotals = {};
    let totalValue = 0;

    assetsList.forEach((asset) => {
      const category = asset.category;
      const value = parseFloat(asset.value) || 0;

      if (!categoryTotals[category]) {
        categoryTotals[category] = 0;
      }

      categoryTotals[category] += value;
      totalValue += value;
    });

    // Préparation des données pour le graphique
    const chartData = [];
    const results = [];

    // Palette de couleurs variée
    const colors = [
      '#FF6B6B', // Rouge corail
      '#4ECDC4', // Turquoise
      '#45B7D1', // Bleu clair
      '#96CEB4', // Vert pastel
      '#FFEEAD', // Jaune pâle
      '#D4A5A5', // Rose poudré
      '#9B5DE5', // Violet
      '#F15BB5', // Rose vif
    ];

    let colorIndex = 0;
    for (const category in categoryTotals) {
      const categoryValue = categoryTotals[category];
      const percentage = ((categoryValue / totalValue) * 100).toFixed(2);
      results.push(
        `${category}: ${categoryValue.toLocaleString()} € (${percentage}%)`
      );

      chartData.push({
        category: category,
        value: categoryValue,
        percentage: percentage,
        color: colors[colorIndex % colors.length],
      });
      colorIndex++;
    }

    // Affichage de la modal avec le graphique
    showModal(results.join('<br>'), chartData, totalValue);
  });
}

function createPieChart(data, container) {
  const size = Math.min(window.innerWidth * 0.4, 400);
  const radius = (size / 2) * 0.8; // Réduire légèrement pour laisser de la place aux étiquettes
  const centerX = size / 2;
  const centerY = size / 2;

  let total = data.reduce((sum, item) => sum + item.value, 0);
  let startAngle = 0;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.style.display = 'block';
  svg.style.margin = '20px auto';

  // Ajout d'un groupe pour le graphique
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  svg.appendChild(g);

  data.forEach((item) => {
    const percentage = item.value / total;
    const angle = percentage * 2 * Math.PI;
    const endAngle = startAngle + angle;

    // Point médian pour le texte
    const midAngle = startAngle + angle / 2;
    const labelRadius = radius * 0.7; // Position du texte à 70% du rayon

    // Calcul des points
    const x1 = centerX + radius * Math.cos(startAngle);
    const y1 = centerY + radius * Math.sin(startAngle);
    const x2 = centerX + radius * Math.cos(endAngle);
    const y2 = centerY + radius * Math.sin(endAngle);

    // Création du segment
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const largeArcFlag = percentage > 0.5 ? 1 : 0;

    const d = [
      'M',
      centerX,
      centerY,
      'L',
      x1,
      y1,
      'A',
      radius,
      radius,
      0,
      largeArcFlag,
      1,
      x2,
      y2,
      'Z',
    ].join(' ');

    path.setAttribute('d', d);
    path.setAttribute('fill', item.color);

    // Ajouter un effet de survol
    path.style.transition = 'opacity 0.2s';
    path.addEventListener('mouseover', () => (path.style.opacity = '0.8'));
    path.addEventListener('mouseout', () => (path.style.opacity = '1'));

    g.appendChild(path);

    // Ajout du texte
    if (percentage > 0.05) {
      // N'afficher le texte que si le segment est assez grand (>5%)
      const labelX = centerX + labelRadius * Math.cos(midAngle);
      const labelY = centerY + labelRadius * Math.sin(midAngle);

      const text = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'text'
      );
      text.setAttribute('x', labelX);
      text.setAttribute('y', labelY);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('fill', '#FFFFFF');
      text.setAttribute('font-size', '12px');
      text.setAttribute('font-weight', 'bold');
      text.style.textShadow = '1px 1px 2px rgba(0,0,0,0.8)';

      // Diviser le texte en deux lignes
      const tspan1 = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'tspan'
      );
      tspan1.textContent = item.category;
      tspan1.setAttribute('x', labelX);
      tspan1.setAttribute('dy', '-0.6em');

      const tspan2 = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'tspan'
      );
      tspan2.textContent = item.percentage + '%';
      tspan2.setAttribute('x', labelX);
      tspan2.setAttribute('dy', '1.2em');

      text.appendChild(tspan1);
      text.appendChild(tspan2);
      g.appendChild(text);
    }

    startAngle = endAngle;
  });

  container.appendChild(svg);
}

function showModal(content, chartData, totalValue) {
  const existingModal = document.getElementById('assets-modal');
  if (existingModal) {
    existingModal.remove();
  }

  const overlay = document.createElement('div');
  overlay.id = 'assets-overlay';
  overlay.style = `
        position: fixed;
        top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
    `;

  const modal = document.createElement('div');
  modal.id = 'assets-modal';
  modal.style = `
        background: #1c1c1c;
        color: #ffffff;
        padding: 30px;
        border-radius: 15px;
        box-shadow: 0 8px 32px rgba(255, 215, 0, 0.15);
        border: 1px solid rgba(255, 215, 0, 0.2);
        min-width: 600px;
        max-width: 80%;
        font-family: system-ui, -apple-system, sans-serif;
    `;

  const chartContainer = document.createElement('div');
  chartContainer.style = `
        margin: 20px 0;
        text-align: center;
        background: #2a2a2a;
        border-radius: 10px;
        padding: 20px;
        border: 1px solid rgba(255, 215, 0, 0.1);
    `;

  modal.innerHTML = `
        <h2 style="
            color: gold;
            border-bottom: 2px solid gold;
            padding-bottom: 15px;
            margin-bottom: 20px;
            font-size: 24px;
            font-weight: 600;
        ">Résumé des Assets</h2>
        <div style="
            background: #2a2a2a;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 20px;
            border: 1px solid rgba(255, 215, 0, 0.1);
        ">
            <h3 style="
                color: gold;
                margin: 0 0 10px 0;
                font-size: 18px;
            ">Total: ${totalValue.toLocaleString()} €</h3>
            <p style="
                color: #cccccc;
                font-size: 16px;
                line-height: 1.6;
                margin: 0;
            ">${content}</p>
        </div>
    `;

  modal.appendChild(chartContainer);

  const closeButton = document.createElement('button');
  closeButton.textContent = 'Fermer';
  closeButton.style = `
        background: linear-gradient(to bottom, gold, #f4b800);
        color: #000000;
        border: none;
        padding: 12px 24px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 16px;
        font-weight: 500;
        display: block;
        margin: 20px auto 0;
        transition: all 0.2s ease;
    `;
  closeButton.onmouseover = () => {
    closeButton.style.background =
      'linear-gradient(to bottom, #f4b800, #cc9900)';
    closeButton.style.transform = 'scale(1.05)';
  };
  closeButton.onmouseout = () => {
    closeButton.style.background = 'linear-gradient(to bottom, gold, #f4b800)';
    closeButton.style.transform = 'scale(1)';
  };
  closeButton.onclick = () => overlay.remove();
  modal.appendChild(closeButton);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  createPieChart(chartData, chartContainer);
}

chrome.runtime.onMessage.addListener((request) => {
  if (request.action === 'openAssetsModal') {
    consolidateAssets();
  }
});

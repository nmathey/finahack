(function () {
  const CONTAINER_ID = 'finaHack-treemap-container';

  function ensureContainer() {
    let el = document.getElementById(CONTAINER_ID);
    if (el) return el;
    el = document.createElement('section');
    el.id = CONTAINER_ID;
    el.className = 'finaHack-treemap-section';
    // Insert into the main content flow so it doesn't overlay other elements
    const mainEl = document.querySelector('main') || document.querySelector('#root') || document.body;
    el.style.width = '100%';
    el.style.background = '#0b0b0b';
    el.style.color = '#fff';
    el.style.padding = '12px';
    el.style.boxSizing = 'border-box';
    el.style.borderRadius = '8px';
    el.style.margin = '12px 0';

    const wrapper = document.createElement('div');
    wrapper.style.maxWidth = '1200px';
    wrapper.style.margin = '0 auto';
    wrapper.style.width = '100%';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'flex-start';
    header.style.alignItems = 'center';
    header.style.marginBottom = '8px';

    const title = document.createElement('strong');
    title.textContent = 'Répartition (treemap)';
    title.style.color = '#ffffff';
    header.appendChild(title);

    const chart = document.createElement('div');
    chart.id = CONTAINER_ID + '-chart';
    chart.style.width = '100%';
    chart.style.height = '420px';

    wrapper.appendChild(header);
    wrapper.appendChild(chart);
    el.appendChild(wrapper);

    // Try inserting after the exact block requested by the user (XPath),
    // otherwise fall back to inserting at the top of the main content.
    const userXpath = '/html/body/div[2]/div[2]/div/div/div/main/div/div';
    let inserted = false;
    try {
      const result = document.evaluate(userXpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      const targetNode = result && result.singleNodeValue;
      if (targetNode && targetNode.parentNode) {
        targetNode.parentNode.insertBefore(el, targetNode.nextSibling);
        inserted = true;
      }
    } catch (e) {
      // ignore XPath errors and fallback
    }

    if (!inserted) {
      try {
        if (mainEl.firstChild) mainEl.insertBefore(el, mainEl.firstChild);
        else mainEl.appendChild(el);
      } catch (e) {
        document.body.appendChild(el);
      }
    }
    return el;
  }

  function formatCurrency(v) {
    return (Number(v) || 0).toLocaleString(undefined, {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 2,
    });
  }

  function drawTreemap(items) {
    const container = ensureContainer();
    const chartEl = document.getElementById(CONTAINER_ID + '-chart');
    if (!items || items.length === 0) {
      chartEl.innerHTML = '<div style="padding:12px">Aucune donnée</div>';
      return;
    }
    // Build full hierarchy: Total -> virtual_envelop -> assetClass -> assetVehicle
    const ids = [];
    const labels = [];
    const parents = [];
    const values = [];

    const virtualMap = new Map();
    const classMap = new Map();
    const vehicleMap = new Map();

    items.forEach((it) => {
      const virtualEnvelop = it.virtual_envelop || 'ToBeDefined';
      const cls = it.assetClass || 'ToBeDefined';
      const vehicle = it.assetVehicle || 'ToBeDefined';
      const v = Number(it.currentValue) || 0;

      const virtualId = `virtual::${virtualEnvelop}`;
      const classId = `class::${virtualEnvelop}::${cls}`;
      const vehicleId = `vehicle::${virtualEnvelop}::${cls}::${vehicle}`;

      virtualMap.set(virtualId, (virtualMap.get(virtualId) || 0) + v);
      classMap.set(classId, (classMap.get(classId) || 0) + v);
      vehicleMap.set(vehicleId, (vehicleMap.get(vehicleId) || 0) + v);
    });

    const total = Array.from(virtualMap.values()).reduce((s, v) => s + v, 0);
    ids.push('Total');
    labels.push('Total');
    parents.push('');
    values.push(total);

    for (const [virtualId, v] of virtualMap) {
      ids.push(virtualId);
      labels.push(virtualId.replace(/^virtual::/, ''));
      parents.push('Total');
      values.push(v);
    }

    for (const [classId, v] of classMap) {
      const parts = classId.split('::');
      const virtualId = `virtual::${parts[1]}`;
      ids.push(classId);
      labels.push(parts.slice(2).join('::'));
      parents.push(virtualId);
      values.push(v);
    }

    for (const [vehicleId, v] of vehicleMap) {
      const parts = vehicleId.split('::');
      const classId = `class::${parts[1]}::${parts[2]}`;
      ids.push(vehicleId);
      labels.push(parts.slice(3).join('::'));
      parents.push(classId);
      values.push(v);
    }

    const text = values.map((v) => formatCurrency(v));
    const data = [
      {
        type: 'treemap',
        ids,
        labels,
        parents,
        values,
        branchvalues: 'total',
        text: text,
        hovertemplate: '%{label}: %{text} (%{percentRoot:.2%})<extra></extra>',
        textinfo: 'label+text+percent entry',
      },
    ];
    const layout = {
      autosize: true,
      margin: { t: 10, b: 10, l: 10, r: 10 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { color: '#fff' },
    };

    if (window.Plotly && typeof window.Plotly.newPlot === 'function') {
      try {
        window.Plotly.newPlot(chartEl, data, layout, { displayModeBar: false, responsive: true });
      } catch (e) {
        console.error('Plotly render failed', e);
      }
    } else {
      chartEl.innerHTML = '<div style="padding:12px">Plotly non chargé</div>';
    }
  }

  window.addEventListener('message', (e) => {
    if (!e.data || !e.data.type) return;
    if (e.data.type === 'FINAHACK_TREEMAP_DATA') {
      drawTreemap(e.data.items || []);
    }
    if (e.data.type === 'FINAHACK_TREEMAP_REMOVE') {
      const el = document.getElementById(CONTAINER_ID);
      if (el) el.remove();
    }
  });
})();

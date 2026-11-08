 (function () {
  const STORAGE_KEY = 'flattened_holdings_cache';
  const INJECT_TREEMAP_KEY = 'inject_treemap_into_synthese';
  const tbody = document.querySelector('#assets-table tbody');
  const info = document.getElementById('info');
  const chartEl = document.getElementById('chart');

  function formatCurrency(v) {
    return (Number(v) || 0).toLocaleString(undefined, {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 2,
    });
  }

  function loadAssets() {
    chrome.storage.local.get([STORAGE_KEY], (res) => {
      const arr = (res && res[STORAGE_KEY]) || [];
      renderAssets(arr);
    });
  }
  // restore previously saved selection of assetIds
  const LAST_SELECTION_KEY = 'popup_myasset_last_selection';
  function restoreSelection() {
    chrome.storage.local.get([LAST_SELECTION_KEY], (res) => {
      const sel = Array.isArray(res && res[LAST_SELECTION_KEY])
        ? res[LAST_SELECTION_KEY]
        : [];
      if (sel.length === 0) return;
      const rows = Array.from(tbody.querySelectorAll('tr'));
      rows.forEach((row) => {
        const cb = row.querySelector('input[type=checkbox]');
        const assetId =
          row.dataset.assetId ||
          row.querySelectorAll('td')[1]?.textContent ||
          '';
        if (cb && sel.includes(assetId)) cb.checked = true;
        else if (cb) cb.checked = false;
      });
      // update total/info display
      const items = getSelectedAssets();
      const total = items.reduce(
        (s, it) => s + (Number(it.currentValue) || 0),
        0
      );
      info.textContent = `Montant total sélectionné: ${total.toLocaleString(
        undefined,
        { style: 'currency', currency: 'EUR' }
      )}`;
    });
  }

  function renderAssets(items) {
    tbody.innerHTML = '';
    if (!items || items.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="5">Aucun actif dans le cache. Chargez ou forcez une synchronisation.</td></tr>';
      return;
    }
    items.forEach((it, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><input data-idx="${idx}" type="checkbox" checked></td>
        <td>${escapeHtml(it.assetId || '')}</td>
        <td>${escapeHtml(it.assetName || '')}</td>
        <td>${escapeHtml(it.assetType || '')}</td>
        <td style="text-align:right">${formatCurrency(it.currentValue)}</td>`;
      // store raw numeric value and useful attrs to avoid parsing localized display
      tr.dataset.value = Number(it.currentValue) || 0;
      tr.dataset.assetId = it.assetId || '';
      tr.dataset.assetType = it.assetType || '';
      tr.dataset.assetClass = it.assetClass || '';
      tr.dataset.assetVehicle = it.assetVehicle || '';
      tr.dataset.virtualEnvelop = it.virtual_envelop || '';
      tbody.appendChild(tr);
    });
    // after rendering, try to restore previous selection
    restoreSelection();
  }

  function getSelectedAssets() {
    const checkboxes = Array.from(
      tbody.querySelectorAll('input[type=checkbox]')
    );
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const items = checkboxes
      .filter((cb) => cb.checked)
      .map((cb) => {
        const idx = Number(cb.dataset.idx);
        const row = rows[idx];
        return {
          assetId:
            row.dataset.assetId ||
            row.querySelectorAll('td')[1]?.textContent ||
            '',
          assetName: row.querySelectorAll('td')[2]?.textContent || '',
          assetType:
            row.dataset.assetType ||
            row.querySelectorAll('td')[3]?.textContent ||
            '',
          assetClass: row.dataset.assetClass || '',
          assetVehicle: row.dataset.assetVehicle || '',
          virtual_envelop: row.dataset.virtualEnvelop || '',
          currentValue: Number(row.dataset.value) || 0,
        };
      });
    return items;
  }

  function drawSunburst(items) {
    if (!items || items.length === 0) {
      chartEl.innerHTML = '<div>Aucune donnée sélectionnée</div>';
      return;
    }
    // Build tree by full paths to avoid double-counting: root -> virtual_envelop -> assetClass -> assetVehicle
    const rootId = 'root_total';
    const ids = [];
    const labels = [];
    const parents = [];
    const values = [];

    // maps keyed by path id
    const virtualVals = new Map(); // virtualId -> value
    const classVals = new Map(); // classId -> value
    const vehicleVals = new Map(); // vehicleId -> value

    items.forEach((it) => {
      const virtualEnvelop = it.virtual_envelop || 'ToBeDefined';
      const cls = it.assetClass || 'ToBeDefined';
      const vehicle = it.assetVehicle || 'ToBeDefined';
      const v = Number(it.currentValue) || 0;

      const virtualId = `virtual::${virtualEnvelop}`;
      const classId = `class::${virtualEnvelop}::${cls}`;
      const vehicleId = `vehicle::${virtualEnvelop}::${cls}::${vehicle}`;

      virtualVals.set(virtualId, (virtualVals.get(virtualId) || 0) + v);
      classVals.set(classId, (classVals.get(classId) || 0) + v);
      vehicleVals.set(vehicleId, (vehicleVals.get(vehicleId) || 0) + v);
    });

    // root
    const totalItems = Array.from(classVals.values()).reduce((s, n) => s + n, 0);
    ids.push(rootId);
    labels.push('Total');
    parents.push('');
    values.push(totalItems);

    // virtual_envelop nodes (direct children of root)
    for (const [virtualId, v] of virtualVals) {
      ids.push(virtualId);
      labels.push(virtualId.replace(/^virtual::/, ''));
      parents.push(rootId);
      values.push(v);
    }

    // class nodes (under their virtual_envelop parent)
    for (const [classId, v] of classVals) {
      const parts = classId.split('::');
      const virtualId = `virtual::${parts[1]}`;
      const label = parts.slice(2).join('::');
      ids.push(classId);
      labels.push(label);
      parents.push(virtualId);
      values.push(v);
    }

    // vehicle nodes (under their class parent)
    for (const [vehicleId, v] of vehicleVals) {
      const parts = vehicleId.split('::');
      const classId = `class::${parts[1]}::${parts[2]}`;
      const label = parts.slice(3).join('::');
      ids.push(vehicleId);
      labels.push(label);
      parents.push(classId);
      values.push(v);
    }

    // deterministic color generator for assetClass
    function colorForLabel(label) {
      let h = 0;
      for (let i = 0; i < label.length; i++) {
        h = (h << 5) - h + label.charCodeAt(i);
        h |= 0;
      }
      h = Math.abs(h) % 360;
      return `hsl(${h},60%,45%)`;
    }

    // build colors array: color assetClass nodes by their label, others neutral
    const colors = [];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (id.startsWith('class::')) {
        const label = labels[i] || '';
        colors.push(colorForLabel(label));
      } else {
        colors.push('rgba(200,200,200,0.6)');
      }
    }

    // Ensure parent node values >= sum of direct children to avoid Plotly warnings
    const idToIndex = new Map();
    ids.forEach((id, i) => idToIndex.set(id, i));
    const childrenSum = new Array(ids.length).fill(0);
    parents.forEach((p, i) => {
      if (!p) return;
      const parentIdx = idToIndex.get(p);
      if (parentIdx !== undefined) childrenSum[parentIdx] += values[i];
    });
    for (let i = 0; i < ids.length; i++) {
      if (childrenSum[i] > values[i]) values[i] = childrenSum[i];
    }

    const data = [
      {
        type: 'sunburst',
        ids,
        labels,
        parents,
        values,
        branchvalues: 'total',
        marker: { colors },
        // show numeric value (no currency) and percent of root in hover, plus percent displayed inside
        hovertemplate:
          '%{label}: %{value:.2f} (%{percentRoot:.2%})<extra></extra>',
        textinfo: 'label+percent entry',
        insidetextorientation: 'radial',
      },
    ];
    const layout = { autosize: true, margin: { t: 20, b: 20, l: 20, r: 20 } };
    Plotly.newPlot(chartEl, data, layout, { displayModeBar: false, responsive: true });
  }

  function aggregateByVirtualEnvelop(items) {
    const map = {};
    items.forEach((it) => {
      const key = it.virtual_envelop || 'ToBeDefined';
      map[key] = (map[key] || 0) + (Number(it.currentValue) || 0);
    });
    return Object.keys(map).map((k) => ({ virtual_envelop: k, value: map[k] }));
  }

  function drawTreemap(items) {
    if (!items || items.length === 0) {
      chartEl.innerHTML = '<div>Aucune donnée sélectionnée</div>';
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

    // virtual_envelop nodes
    for (const [virtualId, v] of virtualMap) {
      ids.push(virtualId);
      labels.push(virtualId.replace(/^virtual::/, ''));
      parents.push('Total');
      values.push(v);
    }

    // class nodes
    for (const [classId, v] of classMap) {
      const parts = classId.split('::');
      const virtualId = `virtual::${parts[1]}`;
      ids.push(classId);
      labels.push(parts.slice(2).join('::'));
      parents.push(virtualId);
      values.push(v);
    }

    // vehicle nodes
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
    const layout = { autosize: true, margin: { t: 20, b: 20, l: 20, r: 20 } };
    Plotly.newPlot(chartEl, data, layout, { displayModeBar: false, responsive: true });
  }

  function escapeHtml(s) {
    return (s || '').replace(
      /[&<>"]/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]
    );
  }

  document.getElementById('select-all').addEventListener('click', () => {
    tbody
      .querySelectorAll('input[type=checkbox]')
      .forEach((cb) => (cb.checked = true));
  });

  // init inject toggle state
  const injectCheckbox = document.getElementById('enable-inject');
  if (injectCheckbox) {
    chrome.storage.local.get([INJECT_TREEMAP_KEY], (res) => {
      injectCheckbox.checked = Boolean(res && res[INJECT_TREEMAP_KEY]);
    });
    injectCheckbox.addEventListener('change', (e) => {
      const v = Boolean(e.currentTarget.checked);
      chrome.storage.local.set({ [INJECT_TREEMAP_KEY]: v });
    });
  }
  document.getElementById('clear-all').addEventListener('click', () => {
    tbody
      .querySelectorAll('input[type=checkbox]')
      .forEach((cb) => (cb.checked = false));
  });
  document.getElementById('visualize').addEventListener('click', () => {
    const items = getSelectedAssets();
    console.log('[popup_assetType_distribution] visualize click, items:', items);
    const total = items.reduce(
      (s, it) => s + (Number(it.currentValue) || 0),
      0
    );
    info.textContent = `Montant total sélectionné: ${total.toLocaleString(
      undefined,
      { style: 'currency', currency: 'EUR' }
    )}`;
    // persist selection
    try {
      const selIds = items.map((i) => i.assetId).filter(Boolean);
      chrome.storage.local.set({ [LAST_SELECTION_KEY]: selIds });
    } catch (e) {
      console.warn('save selection failed', e);
    }
    // clear previous chart
    chartEl.innerHTML = '';
    if (typeof Plotly === 'undefined') {
      console.error('Plotly non défini');
      chartEl.innerHTML =
        '<div>Plotly non chargé — vérifiez que `lib/plotly.min.js` est accessible.</div>';
      return;
    }
    try {
      const modeEl = document.getElementById('vis-mode');
      const mode = modeEl ? modeEl.value : 'sunburst';
      if (mode === 'treemap') {
        drawTreemap(items);
      } else {
        drawSunburst(items);
      }
    } catch (e) {
      console.error('Erreur dessin', e);
      // fallback: draw sunburst
      try {
        drawSunburst(items);
      } catch (e2) {
        console.error('Fallback sunburst failed', e2);
        chartEl.innerHTML =
          '<div>Erreur lors du rendu du graphique (voir console).</div>';
      }
    }
  });

  // toggle assets selection visibility
  document.getElementById('toggle-assets').addEventListener('click', (e) => {
    const el = document.getElementById('assets-list');
    const btn = e.currentTarget;
    if (!el) return;
    if (el.style.display === 'none') {
      el.style.display = '';
      btn.textContent = 'Masquer sélection';
    } else {
      el.style.display = 'none';
      btn.textContent = 'Afficher sélection';
    }
  });

  // initial load
  loadAssets();
})();


(function () {
  const STORAGE_KEY = 'flattened_holdings_cache';
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
        <td>${escapeHtml(it.myAssetType || '')}</td>
        <td style="text-align:right">${formatCurrency(it.currentValue)}</td>`;
      // store raw numeric value and useful attrs to avoid parsing localized display
      tr.dataset.value = Number(it.currentValue) || 0;
      tr.dataset.assetId = it.assetId || '';
      tr.dataset.myAssetType = it.myAssetType || '';
      tr.dataset.category = it.category || '';
      tr.dataset.subcategory = it.subcategory || '';
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
          myAssetType:
            row.dataset.myAssetType ||
            row.querySelectorAll('td')[3]?.textContent ||
            '',
          category: row.dataset.category || '',
          subcategory: row.dataset.subcategory || '',
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
    // Build tree by full paths to avoid double-counting: root -> my -> (cat under my) -> (sub under cat)
    const rootId = 'root_total';
    const ids = [];
    const labels = [];
    const parents = [];
    const values = [];

    // maps keyed by path id
    const myVals = new Map(); // myId -> value
    const catVals = new Map(); // catPathId (my::X::cat::Y) -> value
    const subVals = new Map(); // subPathId (my::X::cat::Y::sub::Z) -> value

    items.forEach((it) => {
      const my = it.myAssetType || 'ToBeDefined';
      const cat = it.category || 'ToBeDefined';
      const sub = it.subcategory || 'ToBeDefined';
      const v = Number(it.currentValue) || 0;

      const myId = `my::${my}`;
      const catId = `cat::${my}::${cat}`;
      const subId = `sub::${my}::${cat}::${sub}`;

      myVals.set(myId, (myVals.get(myId) || 0) + v);
      catVals.set(catId, (catVals.get(catId) || 0) + v);
      subVals.set(subId, (subVals.get(subId) || 0) + v);
    });

    // root
    const totalItems = Array.from(myVals.values()).reduce((s, n) => s + n, 0);
    ids.push(rootId);
    labels.push('Total');
    parents.push('');
    values.push(totalItems);

    // my nodes
    for (const [myId, v] of myVals) {
      ids.push(myId);
      labels.push(myId.replace(/^my::/, ''));
      parents.push(rootId);
      values.push(v);
    }

    // cat nodes (under their my parent)
    for (const [catId, v] of catVals) {
      const parts = catId.split('::');
      const myId = `my::${parts[1]}`;
      const label = parts.slice(2).join('::');
      ids.push(catId);
      labels.push(label);
      parents.push(myId);
      values.push(v);
    }

    // sub nodes (under their cat parent)
    for (const [subId, v] of subVals) {
      const parts = subId.split('::');
      const catId = `cat::${parts[1]}::${parts[2]}`;
      const label = parts.slice(3).join('::');
      ids.push(subId);
      labels.push(label);
      parents.push(catId);
      values.push(v);
    }

    // deterministic color generator for myAssetType
    function colorForLabel(label) {
      // simple hash to hue
      let h = 0;
      for (let i = 0; i < label.length; i++) {
        h = (h << 5) - h + label.charCodeAt(i);
        h |= 0;
      }
      h = Math.abs(h) % 360;
      return `hsl(${h},60%,45%)`;
    }

    // build colors array: color myAssetType nodes by their label, others neutral
    const colors = [];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (id.startsWith('my::')) {
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
    const layout = { height: 420, margin: { t: 20, b: 20, l: 20, r: 20 } };
    Plotly.newPlot(chartEl, data, layout, { displayModeBar: false });
  }

  function aggregateByMyAssetType(items) {
    const map = {};
    items.forEach((it) => {
      const key = it.myAssetType || 'ToBeDefined';
      map[key] = (map[key] || 0) + (Number(it.currentValue) || 0);
    });
    return Object.keys(map).map((k) => ({ myAssetType: k, value: map[k] }));
  }

  function drawPie(agg) {
    if (!agg || agg.length === 0) {
      chartEl.innerHTML = '<div>Aucune donnée sélectionnée</div>';
      return;
    }
    const labels = agg.map((a) => a.myAssetType);
    const values = agg.map((a) => a.value);
    const data = [
      {
        labels,
        values,
        type: 'pie',
        textinfo: 'label+percent',
        hoverinfo: 'label+value',
      },
    ];
    const layout = { height: 420, margin: { t: 20, b: 20, l: 20, r: 20 } };
    Plotly.newPlot(chartEl, data, layout, { displayModeBar: false });
  }

  function escapeHtml(s) {
    return (s || '').replace(
      /[&<>"]/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
    );
  }

  document.getElementById('select-all').addEventListener('click', () => {
    tbody
      .querySelectorAll('input[type=checkbox]')
      .forEach((cb) => (cb.checked = true));
  });
  document.getElementById('clear-all').addEventListener('click', () => {
    tbody
      .querySelectorAll('input[type=checkbox]')
      .forEach((cb) => (cb.checked = false));
  });
  document.getElementById('visualize').addEventListener('click', () => {
    const items = getSelectedAssets();
    console.log('[popup_myasset_distribution] visualize click, items:', items);
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
      drawSunburst(items);
    } catch (e) {
      console.error('Erreur dessin sunburst', e);
      // fallback: aggregate by myAssetType and draw pie
      try {
        const agg = aggregateByMyAssetType(items);
        if (agg && agg.length > 0) {
          drawPie(agg);
        } else {
          chartEl.innerHTML =
            '<div>Aucune donnée pour dessiner le graphique.</div>';
        }
      } catch (e2) {
        console.error('Fallback pie failed', e2);
        chartEl.innerHTML =
          '<div>Erreur lors du rendu du graphique (voir console).</div>';
      }
    }
  });

  // initial load
  loadAssets();
})();

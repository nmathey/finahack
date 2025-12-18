document.addEventListener('DOMContentLoaded', () => {
  const tbody = document.querySelector('#assets-table tbody');
  const reloadBtn = document.getElementById('reload-btn');
  const forceRefreshBtn = document.getElementById('force-refresh-btn');
  const saveBtn = document.getElementById('save-btn');
  const status = document.getElementById('status');
  let items = [];

  function render(itemsToRender) {
    tbody.innerHTML = '';
    itemsToRender.forEach((it, idx) => {
      const tr = document.createElement('tr');
      // Colonnes et quels champs sont éditables
      const columns = [
        'holdingId', 'accountName', 'institutionName', 'envelopeType',
        'assetId', 'assetName', 'assetClass', 'assetType', 'assetVehicle',
        'currentValue', 'quantity', 'pnl_amount'
      ];

      const editableFields = new Set(['assetClass', 'assetType', 'assetVehicle', 'virtual_envelop']);

      columns.forEach((col) => {
        const td = document.createElement('td');
        const value = it[col];
        if (editableFields.has(col)) {
          const input = document.createElement('input');
          input.type = 'text';
          input.value = value || '';
          input.dataset.idx = idx;
          input.dataset.field = col;
          input.addEventListener('input', (e) => {
            items[e.target.dataset.idx][e.target.dataset.field] = e.target.value;
          });
          td.appendChild(input);
        } else {
          td.textContent = value ?? '';
        }
        tr.appendChild(td);
      });

      // virtual_envelop editable (col placed after the data columns)
      const tdVirtual = document.createElement('td');
      const inputVirtual = document.createElement('input');
      inputVirtual.type = 'text';
      inputVirtual.value = it.virtual_envelop || '';
      inputVirtual.dataset.idx = idx;
      inputVirtual.dataset.field = 'virtual_envelop';
      inputVirtual.addEventListener('input', (e) => {
        items[e.target.dataset.idx].virtual_envelop = e.target.value;
      });
      tdVirtual.appendChild(inputVirtual);
      tr.appendChild(tdVirtual);

      tbody.appendChild(tr);
    });
  }

  async function loadAndRender() {
    status.textContent = 'Chargement...';
    chrome.storage.local.get('flattened_holdings_cache', (res) => {
      items = Array.isArray(res.flattened_holdings_cache)
        ? res.flattened_holdings_cache
        : [];
      // Migration: ensure `virtual_envelop` defaults to accountName when missing
      let changed = false;
      items = items.map((it) => {
        const copy = { ...it };
        if (!copy.virtual_envelop || copy.virtual_envelop === 'ToBeDefined') {
          copy.virtual_envelop = copy.accountName || '';
          changed = changed || copy.virtual_envelop !== it.virtual_envelop;
        }
        return copy;
      });
      if (changed) {
        chrome.storage.local.set({ flattened_holdings_cache: items });
      }
      render(items);
      status.textContent = `Loaded ${items.length} items`;
    });
  }

  reloadBtn.addEventListener('click', () => loadAndRender());

  forceRefreshBtn.addEventListener('click', () => {
    status.textContent = 'Forcing refresh...';
    chrome.runtime.sendMessage(
      { action: 'FORCE_REFRESH_FLATTENED' },
      (resp) => {
        if (chrome.runtime.lastError) {
          status.textContent = 'Erreur: ' + chrome.runtime.lastError.message;
          return;
        }
        if (resp?.error) {
          status.textContent = 'Erreur: ' + resp.error;
          return;
        }
        status.textContent = `Refresh OK (${resp.count} items)`;
        // reload view from storage
        setTimeout(() => loadAndRender(), 300);
      }
    );
  });

  saveBtn.addEventListener('click', () => {
    // Save the in-memory items array (which was updated by inputs)
    chrome.storage.local.set({ flattened_holdings_cache: items }, () => {
      status.textContent = 'Enregistré';
      setTimeout(() => (status.textContent = ''), 2000);
    });
  });

  // Export current table data as CSV
  const exportBtn = document.getElementById('export-csv-btn');
  function escapeCsv(value) {
    if (value === null || value === undefined) return '';
    const s = String(value);
    if (s.includes('"') || s.includes(',') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  exportBtn.addEventListener('click', () => {
    if (!Array.isArray(items) || items.length === 0) {
      status.textContent = 'Aucune donnée à exporter';
      setTimeout(() => status.textContent = '', 2000);
      return;
    }

    const headers = [
      'holdingId', 'accountName', 'institutionName', 'envelopeType',
      'assetId', 'assetName', 'assetClass', 'assetType', 'assetVehicle',
      'currentValue', 'quantity', 'pnl_amount', 'virtual_envelop'
    ];

    const rows = items.map(it => {
      return headers.map(h => escapeCsv(it[h] ?? '')).join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'virtual_envelop_export.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    status.textContent = 'Export généré';
    setTimeout(() => status.textContent = '', 2000);
  });

  loadAndRender();
});

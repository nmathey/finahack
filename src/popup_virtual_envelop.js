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
      const values = [
        it.holdingId || '',
        it.accountName || '',
        it.institutionName || '',
        it.envelopeType || '',
        it.assetId || '',
        it.assetName || '',
        it.assetType || '',
        it.category || '',
        it.subcategory || '',
        it.currentValue ?? '',
        it.quantity ?? '',
        it.pnl_amount ?? '',
      ];

      // append non-editable columns
      values.forEach((v) => {
        const td = document.createElement('td');
        td.textContent = v;
        tr.appendChild(td);
      });

      // myAssetType editable
      const tdMy = document.createElement('td');
      const inputMy = document.createElement('input');
      inputMy.type = 'text';
      inputMy.value = it.myAssetType || '';
      inputMy.dataset.idx = idx;
      inputMy.dataset.field = 'myAssetType';
      inputMy.addEventListener('input', (e) => {
        items[e.target.dataset.idx].myAssetType = e.target.value;
      });
      tdMy.appendChild(inputMy);
      tr.appendChild(tdMy);

      // virtual_envelop editable
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
      // Migration: ensure `myAssetType` exists and `virtual_envelop` defaults to accountName when missing
      let changed = false;
      items = items.map((it) => {
        const copy = { ...it };
        // ensure myAssetType exists (fallback to assetType)
        if (!copy.myAssetType && (copy.assetType || copy.assetType === '')) {
          copy.myAssetType = copy.assetType || '';
          changed = changed || copy.myAssetType !== it.myAssetType;
        }
        // ensure virtual_envelop uses accountName when missing or placeholder
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
      'assetId', 'assetName', 'assetType', 'category', 'subcategory',
      'currentValue', 'quantity', 'pnl_amount', 'myAssetType', 'virtual_envelop'
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

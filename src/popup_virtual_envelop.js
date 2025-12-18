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
  const addRuleBtn = document.getElementById('add-rule-btn');
  const applyRulesBtn = document.getElementById('apply-rules-btn');
  const rulesContainer = document.getElementById('rules-container');
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

  // --- Rules management ---
  const RULES_KEY = 'assetClass_rules';

  function loadRules(cb) {
    chrome.storage.local.get(RULES_KEY, (res) => {
      const r = Array.isArray(res[RULES_KEY]) ? res[RULES_KEY] : [];
      renderRules(r);
      if (cb) cb(r);
    });
  }

  function saveRules(rules, cb) {
    chrome.storage.local.set({ [RULES_KEY]: rules }, cb || (() => {}));
  }

  function createRuleRow(rule, idx) {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.gap = '8px';
    wrapper.style.marginTop = '6px';

    const fieldSel = document.createElement('select');
    ['assetName','assetType','assetVehicle','institutionName','accountName'].forEach((f)=>{
      const o = document.createElement('option'); o.value = f; o.textContent = f; if (rule.field===f) o.selected=true; fieldSel.appendChild(o);
    });

    const opSel = document.createElement('select');
    ['contains','equals','startsWith','regex'].forEach((oV)=>{const o=document.createElement('option');o.value=oV;o.textContent=oV; if(rule.operator===oV)o.selected=true; opSel.appendChild(o)});

    const pattern = document.createElement('input');
    pattern.type = 'text';
    pattern.value = rule.pattern || '';
    pattern.placeholder = 'mot ou regex';

    const target = document.createElement('select');
    ['Actions','Obligations','Cash','Fonds euros','Immobilier','Matières premières','Exotique','Autre'].forEach((t)=>{const o=document.createElement('option');o.value=t;o.textContent=t; if (rule.target===t) o.selected=true; target.appendChild(o)});

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Suppr';
    delBtn.addEventListener('click', () => {
      const rules = getRulesFromUI();
      rules.splice(idx,1);
      saveRules(rules, ()=> renderRules(rules));
    });

    wrapper.appendChild(fieldSel);
    wrapper.appendChild(opSel);
    wrapper.appendChild(pattern);
    wrapper.appendChild(target);
    wrapper.appendChild(delBtn);
    return wrapper;
  }

  function getRulesFromUI() {
    const rows = Array.from(rulesContainer.children);
    return rows.map((row) => {
      const [fieldSel, opSel, patternInput, targetSel] = row.querySelectorAll('select,input');
      return { field: fieldSel.value, operator: opSel.value, pattern: patternInput.value, target: targetSel.value };
    });
  }

  function renderRules(rules) {
    rulesContainer.innerHTML = '';
    (rules||[]).forEach((r, i) => {
      rulesContainer.appendChild(createRuleRow(r,i));
    });
  }

  addRuleBtn.addEventListener('click', () => {
    loadRules((rules) => {
      rules.push({ field: 'assetName', operator: 'contains', pattern: '', target: 'Actions' });
      saveRules(rules, ()=> renderRules(rules));
    });
  });

  applyRulesBtn.addEventListener('click', () => {
    const rules = getRulesFromUI();
    saveRules(rules, () => {
      applyRules(rules);
    });
  });

  function testRuleOnValue(val, rule) {
    if (val === undefined || val === null) val = '';
    val = String(val);
    const p = rule.pattern || '';
    switch (rule.operator) {
      case 'contains': return val.toLowerCase().includes(p.toLowerCase());
      case 'equals': return val.toLowerCase() === p.toLowerCase();
      case 'startsWith': return val.toLowerCase().startsWith(p.toLowerCase());
      case 'regex':
        try { const re = new RegExp(p); return re.test(val); } catch (e) { return false; }
      default: return false;
    }
  }

  function applyRules(rules) {
    if (!Array.isArray(rules) || rules.length===0) {
      status.textContent = 'Aucune règle définie'; setTimeout(()=>status.textContent='',2000); return;
    }
    let changed = false;
    items = items.map((it)=>{
      const copy = { ...it };
      for (const r of rules) {
        const fieldVal = copy[r.field];
        if (testRuleOnValue(fieldVal, r)) {
          if (copy.assetClass !== r.target) { copy.assetClass = r.target; changed = true; }
          break; // first matching rule applies
        }
      }
      return copy;
    });
    if (changed) {
      chrome.storage.local.set({ flattened_holdings_cache: items }, () => {
        render(items);
        status.textContent = 'Règles appliquées';
        setTimeout(()=>status.textContent='',2000);
      });
    } else {
      status.textContent = 'Aucune modification'; setTimeout(()=>status.textContent='',2000);
    }
  }

  // load rules UI on start
  loadRules();

  loadAndRender();
});

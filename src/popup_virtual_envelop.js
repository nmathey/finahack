document.addEventListener('DOMContentLoaded', () => {
  const tbody = document.querySelector('#assets-table tbody');
  const reloadBtn = document.getElementById('reload-btn');
  const forceRefreshBtn = document.getElementById('force-refresh-btn');
  const saveBtn = document.getElementById('save-btn');
  const status = document.getElementById('status');
  let items = [];

  const ASSET_TYPE_MAP = {
    'Actions': ['Participations côtées'],
    'Obligations': ['Dettes publiques', 'Dettes privées'],
    'Cash': ['Devises'],
    'Fonds euros': ['Fonds Euro'],
    'Immobilier': ['Physique', 'Papier'],
    'Exotique': ['Crypto', 'Participation non côtées'],
    'Matières premières': ['Physique', 'Papier'],
    'Autre': ['Autre']
  };

  function getAssetTypeOptions(assetClass) {
    if (!assetClass) return [];
    return ASSET_TYPE_MAP[assetClass] || [];
  }

  function getAllAssetTypeValues() {
    const s = new Set();
    Object.values(ASSET_TYPE_MAP).forEach((arr) => arr.forEach((v) => s.add(v)));
    return Array.from(s);
  }

  function getAllAssetVehicleValues() {
    const s = new Set();
    // iterate all asset types and classes
    getAllAssetTypeValues().forEach((atype) => {
      // try all possible classes, use '' for class-agnostic
      Object.keys(ASSET_TYPE_MAP).forEach((cls) => {
        const opts = getAssetVehicleOptions(atype, cls);
        opts.forEach((v) => s.add(v));
      });
    });
    return Array.from(s);
  }

  function getDefaultVirtualEnvelop(assetClass, assetType) {
    const cls = String(assetClass || '').trim().toLowerCase();
    const type = String(assetType || '').trim().toLowerCase();
    if (cls === 'actions' || cls === 'obligations') return 'Bourse';
    if (cls === 'cash') return 'Cash';
    if (cls === 'fonds_euro' || cls === 'fonds euros') return 'Fonds euros';
    if (cls === 'immobilier') return 'Immobilier';
    if ((cls === 'exotique' && type === 'participation non côtées') || cls === 'matières premières') return 'Investissement alternatif';
    if (type === 'crypto') return 'Crypto';
    return '';
  }

  function isStandardVirtualEnvelop(value) {
    const normalized = String(value || '').trim();
    return ['Bourse', 'Cash', 'Fonds euros', 'Immobilier', 'Investissement alternatif', 'Crypto'].includes(normalized);
  }

  function getAssetVehicleOptions(assetType, assetClass) {
    // Defaults per spec. Some depend on assetClass as well.
    if (!assetType) return [];
    switch (assetType) {
      case 'Participations côtées':
        return ['Titre', 'Token crypto', 'ETF', 'Fonds'];
      case 'Dettes publiques':
        return ['ETF', 'Fonds', 'Token crypto', 'Obligation'];
      case 'Dettes privées':
        return ['Crowdlending', 'Token crypto', 'Fonds'];
      case 'Devises':
        return ['Fiat', 'Stablecoin'];
      case 'Fonds Euro':
        return ['Fonds Euro'];
      case 'Physique':
        if (assetClass === 'Immobilier') return ['Immeuble', 'SCI'];
        return ['Physique'];
      case 'Papier':
        if (assetClass === 'Immobilier') return ['SCPI', 'Token crypto', 'ETF', 'Fonds'];
        if (assetClass === 'Matières premières') return ['ETF', 'Token crypto', 'Fonds'];
        return ['Papier'];
      case 'Crypto':
        return ['Token crypto', 'NFT crypto'];
      case 'Participation non côtées':
        return ['Fonds', 'Token crypto', 'Titre'];
      default:
        return [];
    }
  }

  function buildSelectWithPlaceholder(options, selectedValue, placeholderLabel) {
    const sel = document.createElement('select');
    const normSelected = String(selectedValue ?? '').trim();
    const cleanOptions = (options || []).filter((opt) => opt !== undefined && opt !== null && String(opt).trim() !== '');

    const blankOption = document.createElement('option');
    blankOption.value = '';
    blankOption.textContent = placeholderLabel;
    if (!normSelected) blankOption.selected = true;
    sel.appendChild(blankOption);

    cleanOptions.forEach((opt) => {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      if (normSelected === opt) o.selected = true;
      sel.appendChild(o);
    });

    if (normSelected && !cleanOptions.includes(normSelected)) {
      sel.value = '';
    }

    return sel;
  }

  function render(itemsToRender, changedIndices) {
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
          // assetClass: select controlling assetType options
          if (col === 'assetClass') {
            const sel = buildSelectWithPlaceholder(Object.keys(ASSET_TYPE_MAP), value || '', '— Classe —');
            sel.dataset.idx = idx;
            sel.dataset.field = 'assetClass';
            sel.addEventListener('change', (e) => {
              const i = Number(e.target.dataset.idx);
              const v = e.target.value;
              const currentVirtual = items[i].virtual_envelop || '';
              const shouldUpdateVirtual = !currentVirtual || isStandardVirtualEnvelop(currentVirtual);
              items[i].assetClass = v;
              if (!v) {
                items[i].assetType = '';
                items[i].assetVehicle = '';
              }
              // update corresponding assetType select in the same row
              const row = tbody.querySelectorAll('tr')[i];
              if (row) {
                const assetTypeSel = row.querySelector('select[data-field="assetType"]');
                const opts = getAssetTypeOptions(v);
                if (assetTypeSel) {
                  assetTypeSel.innerHTML = '';
                  const typeOptions = buildSelectWithPlaceholder(opts, items[i].assetType || '', '— Type —');
                  assetTypeSel.replaceWith(typeOptions);
                  typeOptions.dataset.idx = i;
                  typeOptions.dataset.field = 'assetType';
                  typeOptions.addEventListener('change', (event) => {
                    const rowIndex = Number(event.target.dataset.idx);
                    const nextType = event.target.value;
                    const currentRowVirtual = items[rowIndex].virtual_envelop || '';
                    const shouldRefreshVirtual = !currentRowVirtual || isStandardVirtualEnvelop(currentRowVirtual);
                    items[rowIndex].assetType = nextType;
                    const rowNode = tbody.querySelectorAll('tr')[rowIndex];
                    if (rowNode) {
                      const vehicleSel = rowNode.querySelector('select[data-field="assetVehicle"]');
                      const optsV = getAssetVehicleOptions(nextType, items[rowIndex].assetClass);
                      if (vehicleSel) {
                        vehicleSel.innerHTML = '';
                        const vehicleOptions = buildSelectWithPlaceholder(optsV, items[rowIndex].assetVehicle || '', '— Véhicule —');
                        vehicleSel.replaceWith(vehicleOptions);
                        vehicleOptions.dataset.idx = rowIndex;
                        vehicleOptions.dataset.field = 'assetVehicle';
                        vehicleOptions.addEventListener('change', (vehicleEvent) => {
                          items[Number(vehicleEvent.target.dataset.idx)].assetVehicle = vehicleEvent.target.value;
                        });
                        if (nextType && optsV.includes(items[rowIndex].assetVehicle)) {
                          items[rowIndex].assetVehicle = items[rowIndex].assetVehicle;
                        } else {
                          items[rowIndex].assetVehicle = '';
                        }
                      }
                      if (shouldRefreshVirtual) {
                        const newVirtual = getDefaultVirtualEnvelop(items[rowIndex].assetClass, items[rowIndex].assetType);
                        if (newVirtual) {
                          items[rowIndex].virtual_envelop = newVirtual;
                          const rowInput = rowNode.querySelector('input[data-field="virtual_envelop"]');
                          if (rowInput) rowInput.value = newVirtual;
                        }
                      }
                    }
                  });
                  const currentAssetType = opts.includes(items[i].assetType) ? items[i].assetType : '';
                  items[i].assetType = currentAssetType;
                  typeOptions.value = currentAssetType || '';
                  try { typeOptions.dispatchEvent(new Event('change')); } catch (err) { /* ignore */ }
                }
              }
              if (shouldUpdateVirtual) {
                const newVirtual = getDefaultVirtualEnvelop(items[i].assetClass, items[i].assetType);
                if (newVirtual) {
                  items[i].virtual_envelop = newVirtual;
                  const rowInput = row?.querySelector('input[data-field="virtual_envelop"]');
                  if (rowInput) rowInput.value = newVirtual;
                }
              }
            });
            td.appendChild(sel);
          }
          // assetType: select whose options depend on assetClass
          else if (col === 'assetType') {
            const sel = buildSelectWithPlaceholder(getAssetTypeOptions(it.assetClass || ''), value || '', '— Type —');
            sel.dataset.idx = idx;
            sel.dataset.field = 'assetType';
            sel.addEventListener('change', (e) => {
              const i = Number(e.target.dataset.idx);
              const v = e.target.value;
              const currentVirtual = items[i].virtual_envelop || '';
              const shouldUpdateVirtual = !currentVirtual || isStandardVirtualEnvelop(currentVirtual);
              items[i].assetType = v;
              if (!v) {
                items[i].assetVehicle = '';
              }
              // update vehicle select for this row
              const row = tbody.querySelectorAll('tr')[i];
              if (row) {
                const vehicleSel = row.querySelector('select[data-field="assetVehicle"]');
                const optsV = getAssetVehicleOptions(v, items[i].assetClass);
                if (vehicleSel) {
                  vehicleSel.innerHTML = '';
                  const vehicleOptions = buildSelectWithPlaceholder(optsV, items[i].assetVehicle || '', '— Véhicule —');
                  vehicleSel.replaceWith(vehicleOptions);
                  vehicleOptions.dataset.idx = i;
                  vehicleOptions.dataset.field = 'assetVehicle';
                  vehicleOptions.addEventListener('change', (vehicleEvent) => {
                    items[Number(vehicleEvent.target.dataset.idx)].assetVehicle = vehicleEvent.target.value;
                  });
                  const validVehicle = optsV.includes(items[i].assetVehicle) ? items[i].assetVehicle : '';
                  items[i].assetVehicle = validVehicle;
                  vehicleOptions.value = validVehicle || '';
                }
                if (shouldUpdateVirtual) {
                  const newVirtual = getDefaultVirtualEnvelop(items[i].assetClass, items[i].assetType);
                  if (newVirtual) {
                    items[i].virtual_envelop = newVirtual;
                    const rowInput = row.querySelector('input[data-field="virtual_envelop"]');
                    if (rowInput) rowInput.value = newVirtual;
                  }
                }
              }
            });
            td.appendChild(sel);
          }
          // assetVehicle: dependent select based on assetType (and assetClass when needed)
          else {
            const selV = buildSelectWithPlaceholder(getAssetVehicleOptions(it.assetType || '', it.assetClass || ''), value || '', '— Véhicule —');
            selV.dataset.idx = idx;
            selV.dataset.field = 'assetVehicle';
            selV.addEventListener('change', (e) => {
              items[e.target.dataset.idx].assetVehicle = e.target.value;
            });
            td.appendChild(selV);
          }
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

      // highlight if this row was changed by rules
      if (changedIndices && changedIndices.has(idx)) {
        tr.classList.add('auto-updated');
        // remove highlight after a short delay
        setTimeout(() => { try { tr.classList.remove('auto-updated'); } catch (e) {} }, 3500);
      }

      tbody.appendChild(tr);
    });
  }

  async function loadAndRender() {
    status.textContent = 'Chargement...';
    chrome.storage.local.get('flattened_holdings_cache', (res) => {
      items = Array.isArray(res.flattened_holdings_cache)
        ? res.flattened_holdings_cache
        : [];
      // Migration: ensure `virtual_envelop` defaults to rule-based names when missing or legacy placeholder
      let changed = false;
      items = items.map((it) => {
        const copy = { ...it };
        const defaultVirtual = getDefaultVirtualEnvelop(copy.assetClass, copy.assetType);
        if (!copy.virtual_envelop || copy.virtual_envelop === 'ToBeDefined' || copy.virtual_envelop === copy.accountName) {
          if (defaultVirtual) {
            copy.virtual_envelop = defaultVirtual;
          } else {
            copy.virtual_envelop = copy.accountName || '';
          }
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
  const applyDefaultsBtn = document.getElementById('apply-defaults-btn');
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
      setTimeout(() => (status.textContent = ''), 2000);
      return;
    }

    const headers = [
      'holdingId', 'accountName', 'institutionName', 'envelopeType',
      'assetId', 'assetName', 'assetClass', 'assetType', 'assetVehicle',
      'currentValue', 'quantity', 'pnl_amount', 'virtual_envelop'
    ];

    const rows = items.map((it) => {
      return headers.map((h) => escapeCsv(it[h] ?? '')).join(',');
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
    setTimeout(() => (status.textContent = ''), 2000);
  });

  // --- Rules management ---
  const RULES_KEY = 'assetClass_rules';

  function loadRules(cb) {
    chrome.storage.local.get(RULES_KEY, (res) => {
      let r = Array.isArray(res[RULES_KEY]) ? res[RULES_KEY] : [];
      // migrate legacy rules that used `target` string to new {targetField,targetValue}
      r = r.map((rule) => {
        if (rule && rule.target && !rule.targetField) {
          return { ...rule, targetField: 'assetClass', targetValue: rule.target };
        }
        return rule;
      });
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
    ['assetName','assetType','assetVehicle','institutionName','accountName', 'envelopeType'].forEach((f)=>{
      const o = document.createElement('option'); o.value = f; o.textContent = f; if (rule.field===f) o.selected=true; fieldSel.appendChild(o);
    });

    const opSel = document.createElement('select');
    ['contains','equals','startsWith','regex'].forEach((oV)=>{const o=document.createElement('option');o.value=oV;o.textContent=oV; if(rule.operator===oV)o.selected=true; opSel.appendChild(o)});

    const pattern = document.createElement('input');
    pattern.type = 'text';
    pattern.value = rule.pattern || '';
    pattern.placeholder = 'mot ou regex';

    // targetField select (which field to set)
    const targetFieldSel = document.createElement('select');
    ['assetClass','assetType','assetVehicle'].forEach((f)=>{const o=document.createElement('option');o.value=f;o.textContent=f; if ((rule.targetField||'assetClass')===f) o.selected=true; targetFieldSel.appendChild(o)});

    // targetValue select (values depend on targetField)
    const targetValueSel = document.createElement('select');
    function populateTargetValues(field, selected) {
      targetValueSel.innerHTML = '';
      let opts = [];
      if (field === 'assetClass') opts = Object.keys(ASSET_TYPE_MAP);
      else if (field === 'assetType') opts = getAllAssetTypeValues();
      else if (field === 'assetVehicle') opts = getAllAssetVehicleValues();
      opts.forEach((t)=>{const o=document.createElement('option'); o.value = t; o.textContent = t; if ((selected||'')===t) o.selected=true; targetValueSel.appendChild(o)});
    }
    // support legacy `rule.target` value
    const legacyTarget = rule.target || '';
    const initialTargetField = rule.targetField || (legacyTarget ? 'assetClass' : 'assetClass');
    const initialTargetValue = rule.targetValue || legacyTarget || 'Actions';
    populateTargetValues(initialTargetField, initialTargetValue);

    targetFieldSel.addEventListener('change', (e) => {
      populateTargetValues(e.target.value);
    });

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Suppr';
    delBtn.addEventListener('click', () => {
      const currentRows = Array.from(rulesContainer.children);
      const myIndex = currentRows.indexOf(wrapper);
      const rules = getRulesFromUI();
      if (myIndex >= 0 && myIndex < rules.length) {
        rules.splice(myIndex, 1);
        saveRules(rules, () => renderRules(rules));
      }
    });

    wrapper.appendChild(fieldSel);
    wrapper.appendChild(opSel);
    wrapper.appendChild(pattern);
    wrapper.appendChild(targetFieldSel);
    wrapper.appendChild(targetValueSel);
    wrapper.appendChild(delBtn);
    return wrapper;
  }

  function getRulesFromUI() {
    const rows = Array.from(rulesContainer.children);
    return rows.map((row) => {
      const selects = row.querySelectorAll('select');
      const fieldSel = selects[0];
      const opSel = selects[1];
      const targetFieldSel = selects[2];
      const targetValueSel = selects[3];
      const patternInput = row.querySelector('input[type=text]');
      return { field: fieldSel.value, operator: opSel.value, pattern: patternInput.value, targetField: targetFieldSel.value, targetValue: targetValueSel.value };
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
      rules.push({ field: 'assetName', operator: 'contains', pattern: '', targetField: 'assetClass', targetValue: 'Actions' });
      saveRules(rules, ()=> renderRules(rules));
    });
  });

  applyRulesBtn.addEventListener('click', () => {
    const rules = getRulesFromUI();
    saveRules(rules, () => {
      applyRules(rules);
    });
  });

  applyDefaultsBtn.addEventListener('click', () => {
    const changedIdxs = new Set();
    let changed = false;
    items = items.map((it, idx) => {
      const copy = { ...it };
      const defaultVirtual = getDefaultVirtualEnvelop(copy.assetClass, copy.assetType);
      if (defaultVirtual && copy.virtual_envelop !== defaultVirtual) {
        copy.virtual_envelop = defaultVirtual;
        changed = true;
        changedIdxs.add(idx);
      }
      return copy;
    });
    if (changed) {
      chrome.storage.local.set({ flattened_holdings_cache: items }, () => {
        render(items, changedIdxs);
        status.textContent = 'Enveloppes par défaut appliquées';
        setTimeout(()=>status.textContent='',2000);
      });
    } else {
      status.textContent = 'Aucune modification';
      setTimeout(()=>status.textContent='',2000);
    }
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
    const changedIdxs = new Set();
    items = items.map((it, idx)=>{
      const copy = { ...it };
      let rowChanged = false;
      for (const r of rules) {
        const fieldVal = copy[r.field];
        if (testRuleOnValue(fieldVal, r)) {
          // apply rule to correct target field
          const tf = r.targetField || 'assetClass';
          const tv = r.targetValue || r.target || '';
          if (tf === 'assetClass') {
            if (copy.assetClass !== tv) { copy.assetClass = tv; rowChanged = true; changed = true; }
            // when assetClass set, ensure assetType and vehicle remain valid or are intentionally left blank
            const optsA = getAssetTypeOptions(copy.assetClass);
            if (copy.assetClass && copy.assetType && !optsA.includes(copy.assetType)) {
              copy.assetType = '';
              rowChanged = true; changed = true;
            }
            const optsV1 = getAssetVehicleOptions(copy.assetType || '', copy.assetClass || '');
            if (copy.assetType && copy.assetVehicle && !optsV1.includes(copy.assetVehicle)) {
              copy.assetVehicle = '';
              rowChanged = true; changed = true;
            }
          } else if (tf === 'assetType') {
            if (copy.assetType !== tv) { copy.assetType = tv; rowChanged = true; changed = true; }
            // when assetType set, ensure vehicle remains valid or is intentionally left blank
            const optsV2 = getAssetVehicleOptions(copy.assetType || '', copy.assetClass || '');
            if (copy.assetType && copy.assetVehicle && !optsV2.includes(copy.assetVehicle)) {
              copy.assetVehicle = '';
              rowChanged = true; changed = true;
            }
          } else if (tf === 'assetVehicle') {
            if (copy.assetVehicle !== tv) { copy.assetVehicle = tv; rowChanged = true; changed = true; }
          }
          // continue to allow other rules to apply as well
        }
      }
      if (rowChanged) changedIdxs.add(idx);
      return copy;
    });
    if (changed) {
      chrome.storage.local.set({ flattened_holdings_cache: items }, () => {
        render(items, changedIdxs);
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

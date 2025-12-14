(function(){
  const STORAGE_KEY = 'flattened_holdings_cache';
  const tbody = document.querySelector('#assets-table tbody');
  const info = document.getElementById('info');
  const chartEl = document.getElementById('chart');

  function formatCurrency(v){
    return (Number(v)||0).toLocaleString(undefined,{style:'currency',currency:'EUR',maximumFractionDigits:2});
  }

  function loadAssets(){
    chrome.storage.local.get([STORAGE_KEY], (res)=>{
      const arr = (res && res[STORAGE_KEY]) || [];
      renderAssets(arr);
    });
  }

  function renderAssets(items){
    tbody.innerHTML = '';
    if(!items || items.length===0){
      tbody.innerHTML = '<tr><td colspan="5">Aucun actif dans le cache. Chargez ou forcez une synchronisation.</td></tr>';
      return;
    }
    items.forEach((it,idx)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><input data-idx="${idx}" type="checkbox" checked></td>
        <td>${escapeHtml(it.assetId||'')}</td>
        <td>${escapeHtml(it.assetName||'')}</td>
        <td>${escapeHtml(it.myAssetType||'')}</td>
        <td style="text-align:right">${formatCurrency(it.currentValue)}</td>`;
      // store raw numeric value and useful attrs to avoid parsing localized display
      tr.dataset.value = Number(it.currentValue) || 0;
      tr.dataset.assetId = it.assetId || '';
      tr.dataset.myAssetType = it.myAssetType || '';
      tr.dataset.category = it.category || '';
      tr.dataset.subcategory = it.subcategory || '';
      tbody.appendChild(tr);
    });
  }

  function getSelectedAssets(){
    const checkboxes = Array.from(tbody.querySelectorAll('input[type=checkbox]'));
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const items = checkboxes.filter(cb=>cb.checked).map(cb=>{
      const idx = Number(cb.dataset.idx);
      const row = rows[idx];
      return {
        assetId: row.dataset.assetId || row.querySelectorAll('td')[1]?.textContent || '',
        assetName: row.querySelectorAll('td')[2]?.textContent || '',
        myAssetType: row.dataset.myAssetType || row.querySelectorAll('td')[3]?.textContent || '',
        category: row.dataset.category || '',
        subcategory: row.dataset.subcategory || '',
        currentValue: Number(row.dataset.value) || 0
      };
    });
    return items;
  }

  function drawSunburst(items){
    if(!items || items.length===0){
      chartEl.innerHTML = '<div>Aucune donnée sélectionnée</div>';
      return;
    }
    // Aggregate by label at each level to merge identical labels
    const rootId = 'root_total';
    const subMap = new Map(); // subLabel -> {value, parents:Set}
    const catMap = new Map(); // catLabel -> {value, parents:Set of subLabel}
    const myMap = new Map();  // myLabel -> {value, parents:Set of catLabel}

    items.forEach(it => {
      const sub = it.subcategory || 'ToBeDefined';
      const cat = it.category || 'ToBeDefined';
      const my = it.myAssetType || 'ToBeDefined';
      const v = Number(it.currentValue) || 0;

      if(!subMap.has(sub)) subMap.set(sub, { value:0, parents: new Set() });
      subMap.get(sub).value += v;
      subMap.get(sub).parents.add(rootId);

      if(!catMap.has(cat)) catMap.set(cat, { value:0, parents: new Set() });
      catMap.get(cat).value += v;
      catMap.get(cat).parents.add(sub);

      if(!myMap.has(my)) myMap.set(my, { value:0, parents: new Set() });
      myMap.get(my).value += v;
      myMap.get(my).parents.add(cat);
    });

    const ids = [];
    const labels = [];
    const parents = [];
    const values = [];

    // root
    ids.push(rootId); labels.push('Total'); parents.push(''); values.push(
      Array.from(subMap.values()).reduce((s,n)=>s+n.value,0)
    );

    // subs (always parent=root)
    for(const [subLabel, obj] of subMap){
      ids.push(`sub::${subLabel}`);
      labels.push(subLabel);
      parents.push(rootId);
      values.push(obj.value);
    }

    // categories: if category appears under a single subLabel, attach to that sub; otherwise attach to root
    for(const [catLabel, obj] of catMap){
      const parentSubs = Array.from(obj.parents);
      let parentId = rootId;
      if(parentSubs.length === 1){
        parentId = `sub::${parentSubs[0]}`;
      }
      ids.push(`cat::${catLabel}`);
      labels.push(catLabel);
      parents.push(parentId);
      values.push(obj.value);
    }

    // myAssetType: if appears under single category label, attach to that category; else attach to root
    for(const [myLabel, obj] of myMap){
      const parentCats = Array.from(obj.parents);
      let parentId = rootId;
      if(parentCats.length === 1){
        parentId = `cat::${parentCats[0]}`;
      }
      ids.push(`my::${myLabel}`);
      labels.push(myLabel);
      parents.push(parentId);
      values.push(obj.value);
    }

    // deterministic color generator for myAssetType
    function colorForLabel(label){
      // simple hash to hue
      let h = 0;
      for(let i=0;i<label.length;i++){ h = (h<<5) - h + label.charCodeAt(i); h |= 0; }
      h = Math.abs(h) % 360;
      return `hsl(${h},60%,45%)`;
    }

    // build colors array: color myAssetType nodes by their label, others neutral
    const colors = [];
    for(let i=0;i<ids.length;i++){
      const id = ids[i];
      if(id.startsWith('my::')){
        const label = labels[i] || '';
        colors.push(colorForLabel(label));
      } else {
        colors.push('rgba(200,200,200,0.6)');
      }
    }

    const data = [{
      type: 'sunburst', ids, labels, parents, values,
      branchvalues: 'total',
      marker: { colors },
      hovertemplate: '%{label}: %{value:$,.2f}<extra></extra>'
    }];
    const layout = {height:420, margin:{t:20,b:20,l:20,r:20}};
    Plotly.newPlot(chartEl, data, layout, {displayModeBar:false});
  }

  function aggregateByMyAssetType(items){
    const map = {};
    items.forEach(it=>{
      const key = it.myAssetType || 'ToBeDefined';
      map[key] = (map[key]||0) + (Number(it.currentValue)||0);
    });
    return Object.keys(map).map(k=>({myAssetType:k,value:map[k]}));
  }

  function drawPie(agg){
    if(!agg || agg.length===0){
      chartEl.innerHTML = '<div>Aucune donnée sélectionnée</div>';
      return;
    }
    const labels = agg.map(a=>a.myAssetType);
    const values = agg.map(a=>a.value);
    const data = [{labels, values, type:'pie', textinfo:'label+percent', hoverinfo:'label+value'}];
    const layout = {height:420, margin:{t:20,b:20,l:20,r:20}};
    Plotly.newPlot(chartEl, data, layout, {displayModeBar:false});
  }

  function escapeHtml(s){
    return (s||'').replace(/[&<>\"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));
  }

  document.getElementById('select-all').addEventListener('click', ()=>{
    tbody.querySelectorAll('input[type=checkbox]').forEach(cb=>cb.checked=true);
  });
  document.getElementById('clear-all').addEventListener('click', ()=>{
    tbody.querySelectorAll('input[type=checkbox]').forEach(cb=>cb.checked=false);
  });
  document.getElementById('visualize').addEventListener('click', ()=>{
    const items = getSelectedAssets();
    const total = items.reduce((s,it)=>s + (Number(it.currentValue)||0), 0);
    info.textContent = `Montant total sélectionné: ${total.toLocaleString(undefined,{style:'currency',currency:'EUR'})}`;
    try{
      drawSunburst(items);
    }catch(e){
      console.error('Erreur dessin sunburst', e);
      chartEl.innerHTML = '<div>Erreur lors du rendu du graphique (voir console).</div>';
    }
  });

  // initial load
  loadAssets();
})();

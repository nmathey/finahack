document.addEventListener('DOMContentLoaded', () => {
  const timestampArea = document.getElementById('timestamp-area');
  const messageArea = document.getElementById('message-area');
  const topGainingAssetsList = document.getElementById('top-gaining-assets');
  const topLosingAssetsList = document.getElementById('top-losing-assets');
  const topGainingEnvelopesList = document.getElementById(
    'top-gaining-envelopes'
  );
  const topLosingEnvelopesList = document.getElementById(
    'top-losing-envelopes'
  );
  const topGainingClassesList = document.getElementById('top-gaining-classes');
  const topLosingClassesList = document.getElementById('top-losing-classes');

  function renderList(element, data) {
    if (!element) return;
    element.innerHTML = '';
    if (data && data.length > 0) {
      data.forEach((item) => {
        const li = document.createElement('li');
        li.textContent = `${item.name}: ${item.valueChange.toFixed(2)}`;
        element.appendChild(li);
      });
    } else {
      const li = document.createElement('li');
      li.textContent = 'No data available.';
      element.appendChild(li);
    }
  }

  function renderData(data) {
    if (!data) {
      messageArea.textContent = 'No Top Movers data found. Please run the analysis first.';
      return;
    }

    if (data.message) {
      messageArea.textContent = data.message;
      return;
    }

    if (data.error) {
      messageArea.textContent = data.error;
      return;
    }

    if (data.oldTimestamp && data.newTimestamp) {
      const oldDate = new Date(data.oldTimestamp);
      const newDate = new Date(data.newTimestamp);
      const durationHours = ((newDate - oldDate) / (1000 * 60 * 60)).toFixed(2);
      timestampArea.textContent = `Evolution calculated from ${oldDate.toLocaleString()} (${durationHours} hours ago)`;
    }

    messageArea.textContent = ''; // Clear message area
    renderList(topGainingAssetsList, data.assets.gainers);
    renderList(topLosingAssetsList, data.assets.losers);
    renderList(topGainingEnvelopesList, data.envelopes.gainers);
    renderList(topLosingEnvelopesList, data.envelopes.losers);
    renderList(topGainingClassesList, data.classes.gainers);
    renderList(topLosingClassesList, data.classes.losers);
  }

  // Initial render
  chrome.storage.local.get('topMoversData', (result) => {
    renderData(result.topMoversData);
  });

  // Listen for changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.topMoversData) {
      renderData(changes.topMoversData.newValue);
    }
  });
});

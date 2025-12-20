document.addEventListener('DOMContentLoaded', () => {
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

  chrome.storage.local.get('topMoversData', (result) => {
    const data = result.topMoversData;
    if (data) {
      if (data.message) {
        messageArea.textContent = data.message;
        return;
      }
      if (data.error) {
        messageArea.textContent = data.error;
        return;
      }

      renderList(topGainingAssetsList, data.assets.gainers);
      renderList(topLosingAssetsList, data.assets.losers);
      renderList(topGainingEnvelopesList, data.envelopes.gainers);
      renderList(topLosingEnvelopesList, data.envelopes.losers);
      renderList(topGainingClassesList, data.classes.gainers);
      renderList(topLosingClassesList, data.classes.losers);
    } else {
      messageArea.textContent =
        'No Top Movers data found. Please run the analysis first.';
    }
  });
});

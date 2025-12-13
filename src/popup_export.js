import { exportFinaryHoldingsToCSV, exportFlattenedAssetsToCSV } from './export-csv.js';

const btn = document.getElementById('export-csv-btn');
const status = document.getElementById('status');

btn.addEventListener('click', async () => {
    status.textContent = "Export en cours...";
    btn.disabled = true;
    try {
        // Check query param to decide which export to run
        const params = new URLSearchParams(window.location.search || '');
        if (params.get('flattened') === '1') {
            await exportFlattenedAssetsToCSV();
        } else {
            await exportFinaryHoldingsToCSV();
        }
        status.textContent = "✅ Export terminé !";
    } catch (e) {
        status.textContent = "❌ Erreur : " + (e.message || e);
    }
    btn.disabled = false;
});
import { exportFinaryHoldingsToCSV } from './export-csv.js';

const btn = document.getElementById('export-csv-btn');
const status = document.getElementById('status');

btn.addEventListener('click', async () => {
    status.textContent = "Export en cours...";
    btn.disabled = true;
    try {
        await exportFinaryHoldingsToCSV();
        status.textContent = "✅ Export terminé !";
    } catch (e) {
        status.textContent = "❌ Erreur : " + (e.message || e);
    }
    btn.disabled = false;
});
/**
 * This script handles the User Interface for the ETF Overlap Analyzer feature.
 * It creates the selection modal, orchestrates the analysis, and displays the results.
 */
class EtfOverlapUI {
    constructor() {
        this.analyzer = new EtfOverlapAnalyzer();
        this.modalId = 'etf-overlap-modal';
        this.styleId = 'etf-overlap-styles';
    }

    /**
     * Starts the process by showing the account selection modal.
     */
    async showAccountSelection() {
        // Ensure Plotly is available for charting results later
        this.injectScript(chrome.runtime.getURL('lib/plotly.min.js'));

        this.showModal({
            title: "Analyse de Chevauchement d'ETFs",
            content: '<div class="loader"></div><p>Chargement de vos comptes...</p>',
            actions: ''
        });

        try {
            const holdingsAccounts = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({ action: "GET_HOLDINGS_ACCOUNTS" }, (response) => {
                    if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
                    if (response?.error) return reject(new Error(response.error));
                    resolve(response);
                });
            });

            console.log('[etfOverlapUI] holdingsAccounts response:', holdingsAccounts);

            // Normalize to an array of accounts
            let accountsArray = [];
            if (Array.isArray(holdingsAccounts)) {
                accountsArray = holdingsAccounts;
            } else if (holdingsAccounts?.accounts && Array.isArray(holdingsAccounts.accounts)) {
                accountsArray = holdingsAccounts.accounts;
            } else if (holdingsAccounts && typeof holdingsAccounts === 'object') {
                accountsArray = holdingsAccounts.accounts || holdingsAccounts.data || [];
                if (!Array.isArray(accountsArray)) accountsArray = Object.values(holdingsAccounts);
            }

            if (!accountsArray || accountsArray.length === 0) {
                this.updateModalContent({ content: `<p>Erreur : Impossible de récupérer les comptes.</p><pre>${JSON.stringify(holdingsAccounts, null, 2)}</pre>` });
                return;
            }

            // Filter for accounts that are investment accounts and contain at least one ETF
            const stockAccounts = accountsArray.filter(acc =>
                acc.bank_account_type.account_type === 'investment' &&
                acc.securities.some(s => s.security.security_type === 'etf' && s.security.isin)
            );

            if (stockAccounts.length === 0) {
                this.updateModalContent({ content: '<p>Aucun compte d\'investissement avec des ETFs n\'a été trouvé.</p>' });
                return;
            }

            const accountsHtml = stockAccounts.map(account => {
                const etfCount = account.securities.filter(s => s.security.security_type === 'etf' && s.security.isin).length;
                return `
                    <div class="finary-account-item">
                        <input type="checkbox" id="account-${account.id}" name="finary-accounts" value="${account.id}" checked>
                        <label for="account-${account.id}">
                            <img src="${account.logo_url}" class="finary-account-logo" alt="">
                            <span class="account-name">${account.name}</span>
                            <span class="account-info">(${etfCount} ETF${etfCount > 1 ? 's' : ''})</span>
                        </label>
                    </div>
                `;
            }).join('');

            const modalContent = `
                <p>Sélectionnez les comptes à inclure dans l'analyse :</p>
                <div class="finary-accounts-list">${accountsHtml}</div>
            `;
            const modalActions = '<button id="start-analysis-btn" class="finary-btn finary-btn-primary">Lancer l\'analyse</button>';

            this.updateModalContent({ content: modalContent, actions: modalActions });

            document.getElementById('start-analysis-btn').addEventListener('click', () => this.handleAnalysisStart(stockAccounts));

        } catch (error) {
            console.error("Error during account selection display:", error);
            this.updateModalContent({ content: `<p>Une erreur est survenue : ${error.message}</p>`});
        }
    }

    /**
     * Handles the click on the "Analyze" button.
     * @param {Array<Object>} allAccounts - The list of all available stock accounts.
     */
    async handleAnalysisStart(allAccounts) {
        const selectedCheckboxes = document.querySelectorAll('input[name="finary-accounts"]:checked');
        const selectedAccountIds = Array.from(selectedCheckboxes).map(cb => cb.value);

        if (selectedAccountIds.length === 0) {
            alert("Veuillez sélectionner au moins un compte.");
            return;
        }

        const selectedAccounts = allAccounts.filter(acc => selectedAccountIds.includes(acc.id));

        this.updateModalContent({
            content: '<div class="loader"></div><p>Analyse en cours... <br>Les calculs peuvent prendre quelques secondes.</p>',
            actions: ''
        });

        try {
            // The analysis is asynchronous
            const results = await this.analyzer.analyze(selectedAccounts);
            this.displayResults(results);
        } catch (error) {
            console.error("Error during analysis:", error);
            this.updateModalContent({ content: `<p>Erreur durant l'analyse : ${error.message}</p>` });
        }
    }

    /**
     * Displays the final analysis results in the modal.
     * @param {Object} results - The results from the EtfOverlapAnalyzer.
     */
    displayResults(results) {
        const resultsHtml = `
            <div id="overlap-gauge"></div>
            <div id="overlap-heatmap-container"></div>
            <div class="charts-container">
                <div id="top-overlapped-chart" class="chart-half"></div>
                <div id="country-chart" class="chart-half"></div>
            </div>
            <div id="sector-chart"></div>
        `;
        this.updateModalContent({ content: resultsHtml });

        // Render charts
        this.createGaugeChart(results.relativeOverlap);
        this.createHeatmap(results.pairwiseSimilarities, Object.keys(results.portfolioWeights), results.holdingsData);
        this.createTopOverlappedChart(results.topOverlapped);
        this.createDonutChart('country-chart', 'Répartition par Pays', results.portfolioStats.country_weights);
        this.createDonutChart('sector-chart', 'Répartition par Secteur', results.portfolioStats.sector_weights);
    }

    /**
     * Creates the gauge chart for the overall portfolio overlap.
     * @param {number} value - The overlap percentage.
     */
    createGaugeChart(value) {
        const data = [{
            domain: { x: [0, 1], y: [0, 1] },
            value: value,
            title: { text: "Taux de Similarité du Portefeuille" },
            type: "indicator",
            mode: "gauge+number",
            gauge: {
                axis: { range: [0, 40], tickwidth: 1, tickcolor: "darkblue" },
                bar: { color: "#2a2a2a" },
                bgcolor: "white",
                borderwidth: 2,
                bordercolor: "gray",
                steps: [
                    { range: [0, 5], color: "green" },
                    { range: [5, 15], color: "lightgreen" },
                    { range: [15, 25], color: "orange" },
                    { range: [25, 40], color: "red" }
                ],
            }
        }];
        const layout = {
            width: 550, height: 250,
            margin: { t: 20, b: 20, l:20, r:20 },
            paper_bgcolor: "#1a1a1a",
            font: { color: "white" }
        };
        Plotly.newPlot('overlap-gauge', data, layout);
    }

    /**
     * Creates the heatmap for pairwise ETF similarity.
     * @param {Object} similarities - The pairwise similarity data.
     * @param {Array<string>} etfs - The list of ETF ISINs.
     * @param {Array<Object>} holdingsData - The raw holdings data for lookups.
     */
    createHeatmap(similarities, etfs, holdingsData) {
        const getEtfName = (isin) => {
            const holding = holdingsData.find(h => h.ETF_ISIN === isin);
            return holding ? holding.ETF_Name.replace('UCITS ETF', '').trim() : isin;
        };
        const etfNames = etfs.map(getEtfName);

        const zValues = etfs.map(etf1 =>
            etfs.map(etf2 => {
                if (etf1 === etf2) return 100;
                return similarities[`${etf1}-${etf2}`] || similarities[`${etf2}-${etf1}`] || 0;
            })
        );

        const data = [{
            z: zValues,
            x: etfNames,
            y: etfNames,
            type: 'heatmap',
            hoverongaps: false,
            colorscale: 'Greens'
        }];
        const layout = { title: 'Similarité par Paire (%)', paper_bgcolor: "#1a1a1a", font: { color: "white" }, xaxis: { automargin: true }, yaxis: { automargin: true } };
        Plotly.newPlot('overlap-heatmap-container', data, layout);
    }

    /**
     * Creates a bar chart for the top 10 overlapping holdings.
     * @param {Object} topOverlapped - The top overlapping holdings.
     */
    createTopOverlappedChart(topOverlapped) {
        const tickers = Object.keys(topOverlapped);
        const weights = tickers.map(t => topOverlapped[t].total_weight);
        const names = tickers.map(t => topOverlapped[t].company_name);
        const data = [{
            x: weights,
            y: names,
            type: 'bar',
            orientation: 'h',
            marker: { color: 'lightblue' }
        }];
        const layout = { title: 'Top 10 Holdings en Commun', paper_bgcolor: "#1a1a1a", font: { color: "white" }, yaxis: { automargin: true } };
        Plotly.newPlot('top-overlapped-chart', data, layout);
    }

    /**
     * Creates a donut chart for categorical data (e.g., countries, sectors).
     * @param {string} elementId - The ID of the div to render the chart in.
     * @param {string} title - The title of the chart.
     * @param {Object} data - The data for the chart.
     */
    createDonutChart(elementId, title, data) {
        const sortedData = Object.entries(data).sort(([,a],[,b]) => b-a).slice(0,10);
        const labels = sortedData.map(item => item[0]);
        const values = sortedData.map(item => item[1]);

        const plotData = [{
            labels: labels,
            values: values,
            type: 'pie',
            hole: .4,
            textinfo: "label+percent",
            textposition: "inside"
        }];
        const layout = { title: title, paper_bgcolor: "#1a1a1a", font: { color: "white" }, showlegend: false, height: 400 };
        Plotly.newPlot(elementId, plotData, layout);
    }

    // --- Modal and Style Management ---

    showModal({ title, content, actions }) {
        this.injectStyles();
        let modal = document.getElementById(this.modalId);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = this.modalId;
            document.body.appendChild(modal);
        }
        modal.className = 'etf-overlap-modal';
        modal.innerHTML = `
            <div class="etf-overlap-modal-content">
                <div class="etf-overlap-modal-header">
                    <h2>${title}</h2>
                    <button id="close-etf-modal-btn" class="etf-overlap-close-btn">&times;</button>
                </div>
                <div id="etf-modal-body" class="etf-overlap-modal-body">${content}</div>
                <div id="etf-modal-actions" class="etf-overlap-modal-footer">${actions}</div>
            </div>`;
        modal.style.display = 'block';
        document.getElementById('close-etf-modal-btn').addEventListener('click', () => this.hideModal());
    }

    updateModalContent({ content, actions }) {
        const body = document.getElementById('etf-modal-body');
        if (body) body.innerHTML = content;
        if (actions !== undefined) {
            const footer = document.getElementById('etf-modal-actions');
            if (footer) footer.innerHTML = actions;
        }
    }

    hideModal() {
        const modal = document.getElementById(this.modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    }

    injectScript(url) {
        if (document.querySelector(`script[src="${url}"]`)) return;
        const script = document.createElement('script');
        script.src = url;
        document.head.appendChild(script);
    }

    injectStyles() {
        if (document.getElementById(this.styleId)) return;
        const style = document.createElement('style');
        style.id = this.styleId;
        style.innerHTML = `
            .etf-overlap-modal { display: none; position: fixed; z-index: 10001; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.6); }
            .etf-overlap-modal-content { background-color: #1a1a1a; color: #f1f1f1; margin: 5% auto; padding: 20px; border: 1px solid #888; width: 80%; max-width: 800px; border-radius: 8px; }
            .etf-overlap-modal-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #444; padding-bottom: 10px; }
            .etf-overlap-close-btn { color: #aaa; font-size: 28px; font-weight: bold; cursor: pointer; }
            .etf-overlap-modal-body { padding: 20px 0; max-height: 80vh; overflow-y: auto; }
            .finary-accounts-list { max-height: 400px; overflow-y: auto; margin-top: 15px; }
            .finary-account-item { display: flex; align-items: center; padding: 8px; border-radius: 4px; }
            .finary-account-item:hover { background-color: #2a2a2a; }
            .finary-account-logo { width: 24px; height: 24px; margin-right: 8px; border-radius: 4px; }
            .charts-container { display: flex; flex-wrap: wrap; }
            .chart-half { width: 50%; min-width: 300px; }
            .loader { border: 5px solid #f3f3f3; border-radius: 50%; border-top: 5px solid #3498db; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 20px auto; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `;
        document.head.appendChild(style);
    }
}

// Cette section ne doit s'exécuter que dans le contexte d'un content script (page), pas dans le service worker/background
if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
    if (typeof window.etfOverlapUI === 'undefined') {
        window.etfOverlapUI = new EtfOverlapUI();
    }

    // Remplacement du listener anonyme par une fonction nommée + try/catch
    function handleRuntimeMessage(message, sender, sendResponse) {
        try {
            console.log('[etfOverlapUI] message reçu :', message);
            if (message.action === "showEtfOverlapModal") {
                window.etfOverlapUI.showAccountSelection();
            }
        } catch (err) {
            console.error('[etfOverlapUI] erreur dans handleRuntimeMessage :', err);
            console.error(err && err.stack ? err.stack : '(pas de stack)');
        }
    }
    chrome.runtime.onMessage.addListener(handleRuntimeMessage);

    // Handlers globaux pour capter les erreurs non gérées dans le content script
    window.addEventListener('error', (event) => {
        console.error('[etfOverlapUI] Erreur non gérée :', event.message, '->', `${event.filename}:${event.lineno}:${event.colno}`);
        console.error(event.error && event.error.stack ? event.error.stack : '(pas de stack)');
    });
    window.addEventListener('unhandledrejection', (event) => {
        console.error('[etfOverlapUI] Rejet de promesse non géré :', event.reason);
        console.error(event.reason && event.reason.stack ? event.reason.stack : '(pas de stack)');
    });
}

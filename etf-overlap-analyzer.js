/**
 * This script contains the core logic for analyzing ETF holdings overlap.
 * It fetches and processes data, and performs all necessary calculations.
 */
class EtfOverlapAnalyzer {
    constructor() {
        this.csvUrl = 'https://raw.githubusercontent.com/DrekoDev/Etf-Holdings-Overlap-Analyzer/main/holdings_xd_processed.csv';
        this.cacheKey = 'etfHoldingsDataCache';
        this.cacheDuration = 24 * 60 * 60 * 1000; // 24 hours
    }

    /**
     * Parses a CSV string with a semicolon delimiter into an array of objects.
     * @param {string} csvText The CSV string content.
     * @returns {Array<Object>}
     */
    parseCsv(csvText) {
        const lines = csvText.split('\n');
        if (lines.length === 0) return [];
        const header = lines[0].split(';').map(h => h.trim().replace(/"/g, ''));
        const data = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line) {
                const values = line.split(';');
                const entry = {};
                for (let j = 0; j < header.length; j++) {
                    entry[header[j]] = values[j] ? values[j].trim().replace(/"/g, '') : '';
                }
                data.push(entry);
            }
        }
        return data;
    }

    /**
     * Fetches and caches the ETF holdings data from the source CSV file.
     * @returns {Promise<Array<Object>>} The holdings data.
     */
    async getHoldingsData() {
        const now = new Date().getTime();
        const cachedData = await new Promise(resolve => {
            chrome.storage.local.get(this.cacheKey, result => resolve(result[this.cacheKey]));
        });
        if (cachedData && (now - cachedData.timestamp < this.cacheDuration)) {
            console.log("✅ ETF holdings data loaded from cache.");
            return cachedData.data;
        }
        console.log("⬇️ Fetching new ETF holdings data...");
        const response = await fetch(this.csvUrl);
        if (!response.ok) throw new Error(`Failed to fetch CSV: ${response.statusText}`);
        const csvText = await response.text();
        const parsedData = this.parseCsv(csvText);
        const dataToCache = { timestamp: now, data: parsedData };
        await new Promise(resolve => {
            chrome.storage.local.set({ [this.cacheKey]: dataToCache }, resolve);
        });
        console.log("✅ ETF holdings data cached.");
        return parsedData;
    }

    /**
     * Calculates the weight of each ETF in the portfolio based on its current value.
     * @param {Array<Object>} selectedAccounts - The Finary accounts selected by the user.
     * @returns {Object} A dictionary mapping ETF ISIN to its weight percentage.
     */
    calculatePortfolioWeights(selectedAccounts) {
        const etfValues = {};
        let totalPortfolioValue = 0;

        for (const account of selectedAccounts) {
            for (const security of account.securities) {
                if (security.security.security_type === 'etf' && security.security.isin) {
                    const isin = security.security.isin;
                    const value = security.current_value || 0;
                    if (!etfValues[isin]) {
                        etfValues[isin] = 0;
                    }
                    etfValues[isin] += value;
                    totalPortfolioValue += value;
                }
            }
        }

        if (totalPortfolioValue === 0) return {};

        const portfolioWeights = {};
        for (const isin in etfValues) {
            portfolioWeights[isin] = (etfValues[isin] / totalPortfolioValue) * 100;
        }
        return portfolioWeights;
    }

    /**
     * Calculates the total weight of each underlying ticker in the portfolio.
     * @param {Object} portfolioWeights - A map of ETF ISINs to their portfolio weight.
     * @param {Array<Object>} holdingsData - The raw holdings data from the CSV.
     * @returns {Object} An object containing overlaps, ticker details, and organized holdings.
     */
    calculateOverlap(portfolioWeights, holdingsData) {
        const overlaps = {}; // Maps ticker to its total weight in the portfolio
        const tickerDetails = {}; // Detailed info for each ticker
        const etfHoldings = {}; // Holdings organized by ETF

        const etfIsins = Object.keys(portfolioWeights);
        const relevantHoldings = holdingsData.filter(h => etfIsins.includes(h.ETF_ISIN));

        // First, group holdings by ETF and sum weights for duplicate tickers within the same ETF
        for (const etfIsin of etfIsins) {
            const etfData = relevantHoldings.filter(h => h.ETF_ISIN === etfIsin);
            etfHoldings[etfIsin] = {};
            for (const holding of etfData) {
                const ticker = holding.Ticker;
                if (!ticker) continue;
                const weight = parseFloat(holding.Weight_Percent.replace(',', '.'));
                if (isNaN(weight)) continue;

                if (!etfHoldings[etfIsin][ticker]) {
                    etfHoldings[etfIsin][ticker] = 0;
                }
                etfHoldings[etfIsin][ticker] += weight;
            }
        }

        // Calculate the absolute weight of each ticker in the total portfolio
        for (const [etfIsin, etfWeight] of Object.entries(portfolioWeights)) {
            for (const [ticker, holdingWeight] of Object.entries(etfHoldings[etfIsin] || {})) {
                const portfolioTickerWeight = (holdingWeight / 100) * (etfWeight / 100);
                if (!overlaps[ticker]) {
                    overlaps[ticker] = 0;
                }
                overlaps[ticker] += portfolioTickerWeight;

                if (!tickerDetails[ticker]) {
                    const holdingInfo = relevantHoldings.find(h => h.Ticker === ticker);
                    tickerDetails[ticker] = {
                        company_name: holdingInfo?.Company_Name || ticker,
                        etfs: [],
                        total_weight: 0
                    };
                }
                tickerDetails[ticker].etfs.push({
                    etf: etfIsin,
                    weight_in_etf: holdingWeight,
                    weight_in_portfolio: portfolioTickerWeight * 100
                });
            }
        }

        // Finalize total weight calculation in tickerDetails
        for (const ticker in tickerDetails) {
            tickerDetails[ticker].total_weight = overlaps[ticker] * 100;
        }

        return { overlaps, tickerDetails, etfHoldings };
    }

    /**
     * Calculates the similarity percentage between each pair of ETFs.
     * Similarity = Sum of the minimum weights of common holdings.
     * @param {Object} etfHoldings - Holdings organized by ETF.
     * @returns {Object} A map of ETF pairs to their similarity score.
     */
    calculatePairwiseSimilarity(etfHoldings) {
        const etfList = Object.keys(etfHoldings);
        const similarities = {};
        for (let i = 0; i < etfList.length; i++) {
            for (let j = i + 1; j < etfList.length; j++) {
                const etfA = etfList[i];
                const etfB = etfList[j];
                const tickersA = new Set(Object.keys(etfHoldings[etfA]));
                const tickersB = new Set(Object.keys(etfHoldings[etfB]));
                const commonTickers = new Set([...tickersA].filter(x => tickersB.has(x)));

                let similarity = 0;
                for (const ticker of commonTickers) {
                    const weightA = (etfHoldings[etfA][ticker] || 0) / 100;
                    const weightB = (etfHoldings[etfB][ticker] || 0) / 100;
                    similarity += Math.min(weightA, weightB);
                }
                similarities[`${etfA}-${etfB}`] = similarity * 100;
            }
        }
        return similarities;
    }

    /**
     * Calculates a single, portfolio-weighted overlap score.
     * @param {Object} portfolioWeights - A map of ETF ISINs to their portfolio weight.
     * @param {Object} pairwiseSimilarities - The pre-calculated pairwise similarities.
     * @returns {number} The portfolio-wide overlap score.
     */
    calculateRelativeOverlap(portfolioWeights, pairwiseSimilarities) {
        const etfList = Object.keys(portfolioWeights);
        let totalWeightedSimilarity = 0;
        let totalWeight = 0;

        for (let i = 0; i < etfList.length; i++) {
            for (let j = i + 1; j < etfList.length; j++) {
                const etfA = etfList[i];
                const etfB = etfList[j];
                const pairWeight = (portfolioWeights[etfA] / 100) * (portfolioWeights[etfB] / 100);
                const similarity = pairwiseSimilarities[`${etfA}-${etfB}`] || pairwiseSimilarities[`${etfB}-${etfA}`] || 0;
                totalWeightedSimilarity += similarity * pairWeight;
                totalWeight += pairWeight;
            }
        }
        // The multiplication by 2 is a common method to scale the result to be more intuitive.
        return totalWeight > 0 ? (totalWeightedSimilarity / totalWeight) * 2 : 0;
    }

    /**
     * Calculates portfolio-level statistics like country and sector allocation.
     * @param {Object} portfolioWeights - A map of ETF ISINs to their portfolio weight.
     * @param {Array<Object>} holdingsData - The raw holdings data from the CSV.
     * @returns {Object} An object containing portfolio statistics.
     */
    calculatePortfolioStats(portfolioWeights, holdingsData) {
        const etfIsins = Object.keys(portfolioWeights);
        const relevantHoldings = holdingsData.filter(h => etfIsins.includes(h.ETF_ISIN));

        const countryWeights = {};
        const sectorWeights = {};
        let allTickers = new Set();

        // Use a pre-processed map for faster lookups
        const holdingsByTicker = {};
        for (const holding of relevantHoldings) {
            if (!holdingsByTicker[holding.Ticker]) {
                holdingsByTicker[holding.Ticker] = [];
            }
            holdingsByTicker[holding.Ticker].push(holding);
        }

        for (const [etfIsin, etfWeight] of Object.entries(portfolioWeights)) {
            const etfData = relevantHoldings.filter(h => h.ETF_ISIN === etfIsin);
            for (const holding of etfData) {
                const ticker = holding.Ticker;
                if (!ticker) continue;
                allTickers.add(ticker);

                const weight = parseFloat(holding.Weight_Percent.replace(',', '.'));
                if (isNaN(weight)) continue;

                const portfolioTickerWeight = (weight / 100) * (etfWeight / 100);

                const country = holding.Country || 'Unknown';
                if (!countryWeights[country]) countryWeights[country] = 0;
                countryWeights[country] += portfolioTickerWeight;

                const sector = holding.Industry_Display || 'Unknown';
                if (!sectorWeights[sector]) sectorWeights[sector] = 0;
                sectorWeights[sector] += portfolioTickerWeight;
            }
        }

        return {
            unique_holdings: allTickers.size,
            country_weights: Object.fromEntries(Object.entries(countryWeights).map(([k, v]) => [k, v * 100])),
            sector_weights: Object.fromEntries(Object.entries(sectorWeights).map(([k, v]) => [k, v * 100])),
        };
    }

    /**
     * Main analysis function that orchestrates all calculations.
     * @param {Array<Object>} selectedAccounts - The user's selected Finary accounts.
     * @returns {Promise<Object>} The final analysis results.
     */
    async analyze(selectedAccounts) {
        console.log("🔬 Starting analysis for accounts:", selectedAccounts.map(a => a.name));
        const holdingsData = await this.getHoldingsData();
        const portfolioWeights = this.calculatePortfolioWeights(selectedAccounts);

        if (Object.keys(portfolioWeights).length < 2) {
            throw new Error("Veuillez sélectionner des comptes contenant au moins deux ETFs différents pour l'analyse.");
        }

        const { overlaps, tickerDetails, etfHoldings } = this.calculateOverlap(portfolioWeights, holdingsData);
        const pairwiseSimilarities = this.calculatePairwiseSimilarity(etfHoldings);
        const relativeOverlap = this.calculateRelativeOverlap(portfolioWeights, pairwiseSimilarities);
        const portfolioStats = this.calculatePortfolioStats(portfolioWeights, holdingsData);

        const topOverlapped = Object.entries(tickerDetails)
            .filter(([, details]) => details.etfs.length > 1)
            .sort(([, a], [, b]) => b.total_weight - a.total_weight)
            .slice(0, 10);

        const results = {
            portfolioWeights,
            relativeOverlap,
            pairwiseSimilarities,
            portfolioStats,
            topOverlapped: Object.fromEntries(topOverlapped),
            holdingsData, // Pass full data for name lookups
        };
        console.log("✅ Analysis complete");
        return results;
    }
}

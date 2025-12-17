// ETF overlap analyzer removed — placeholder to avoid import errors.
console.info('etf-overlap-analyzer.js placeholder — ETF overlap feature removed');
export class EtfOverlapAnalyzer {
    async analyze() { throw new Error('EtfOverlapAnalyzer.analyze removed'); }
}
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

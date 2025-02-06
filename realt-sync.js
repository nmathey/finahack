import { FinaryClient } from "./api.js";

export class RealTSync {
    constructor(realtApiToken) {
        this.realtApiToken = realtApiToken;
        this.realtApiUrl = 'https://api.realtoken.community/v1';
    }

    async syncWalletWithFinary(walletAddresses, finaryClient) {
        try {
            // 1. Get all RealT tokens from API
            const allRealTTokens = await this.getAllRealTTokens();
            
            // 2. Get user's RealT token balances for each wallet
            let userTokens = [];
            for (const address of walletAddresses) {
                const tokens = await this.getUserTokenBalances(address, allRealTTokens);
                userTokens = [...userTokens, ...tokens];
            }

            // 3. Get existing RealT properties in Finary
            const finaryRealTProperties = await finaryClient.getRealEstateAssets();
            
            // 4. Sync operations
            for (const token of userTokens) {
                const existingProperty = finaryRealTProperties.find(
                    p => p.name === token.propertyName
                );

                if (existingProperty) {
                    // Update existing property
                    await finaryClient.updateRealEstateAsset({
                        id: existingProperty.id,
                        name: token.propertyName,
                        value: token.totalValue,
                        quantity: token.balance,
                        currency: 'USD'
                    });
                } else {
                    // Add new property
                    await finaryClient.addRealEstateAsset({
                        name: token.propertyName,
                        value: token.totalValue,
                        quantity: token.balance,
                        currency: 'USD',
                        category: 'tokenized'
                    });
                }
            }

            // 5. Remove properties that no longer exist in wallet
            for (const finaryProperty of finaryRealTProperties) {
                const stillOwned = userTokens.some(
                    t => t.propertyName === finaryProperty.name
                );
                
                if (!stillOwned) {
                    await finaryClient.deleteRealEstateAsset(finaryProperty.id);
                }
            }

            return {
                success: true,
                syncedTokens: userTokens.length
            };

        } catch (error) {
            console.error('Sync error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    static async getAllRealTTokens() {
        try {
            // Check cached data
            const cachedData = await new Promise((resolve) => {
                chrome.storage.local.get(['realtTokens', 'realtTokensTimestamp'], (result) => {
                    resolve({
                        tokens: result.realtTokens,
                        timestamp: result.realtTokensTimestamp
                    });
                });
            });
    
            // Check if cache is valid (less than 7 days old)
            const now = Date.now();
            const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
            
            if (cachedData.tokens && cachedData.timestamp && 
                (now - cachedData.timestamp) < CACHE_DURATION) {
                return cachedData.tokens;
            }
    
            // If cache invalid or missing, fetch new data
            const realtToken = await new Promise((resolve) => {
                chrome.storage.local.get('realtToken', (result) => {
                    resolve(result.realtToken);
                });
            });
    
            if (!realtToken) {
                throw new Error("Token RealT non configuré");
            }
    
            const response = await fetch('https://api.realtoken.community/v1/token', {
                headers: {
                    'X-AUTH-REALT-TOKEN': `${realtToken}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
    
            if (!response.ok) {
                throw new Error(`Erreur API RealT: ${response.status}`);
            }
    
            const tokens = await response.json();
    
            // Update cache
            await new Promise((resolve) => {
                chrome.storage.local.set({
                    realtTokens: tokens,
                    realtTokensTimestamp: now
                }, resolve);
            });
    
            return tokens;
    
        } catch (error) {
            console.error('Error getting RealT tokens:', error);
            throw error;
        }
    }

    static async getFinaryRealTProperties() {
        try {
            const finaryClient = new FinaryClient();
            const token = await finaryClient.getSessionToken();
            
            if (!token) {
                throw new Error("Token Finary non disponible");
            }
    
            const response = await finaryClient.getRealEstateAssets();
            console.log("Raw Finary response:", response);
            
            if (!response || !response.result) {
                throw new Error("Impossible de récupérer les biens immobiliers depuis Finary");
            }
    
            const propertiesArray = Array.isArray(response.result) ? response.result : [];
    
            if (!Array.isArray(propertiesArray)) {
                throw new Error("Format de données Finary invalide");
            }
    
            const realtProperties = propertiesArray.filter(property => 
                property?.description?.startsWith("RealT - ")
            );
    
            console.log(`Found ${realtProperties.length} RealT properties in Finary`);
            return realtProperties;
    
        } catch (error) {
            console.error("Error getting RealT properties from Finary:", error);
            throw error;
        }
    }
}
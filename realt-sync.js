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

    async getAllRealTTokens() {
        try {
            // Check cached data
            const cachedData = await new Promise((resolve) => {
                chrome.storage.local.get(['allRealtTokens', 'allRealtTokensTimestamp'], (result) => {
                    resolve({
                        tokens: result.allRealtTokens,
                        timestamp: result.allRealtTokensTimestamp
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
    
            const realtToken = await new Promise((resolve) => {
                chrome.storage.local.get('realtToken', (result) => {
                    resolve(result.realtToken);
                });
            });

            if (!realtToken) {
                throw new Error("Token RealT non configuré");
            }

            const response = await fetch(`${this.realtApiUrl}/token`, {
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
                    allRealtTokens: tokens,
                    allRealtTokensTimestamp: now
                }, resolve);
            });

            return tokens;

        } catch (error) {
            console.error('Error getting RealT tokens:', error);
            throw error;
        }
    }

    async getFinaryRealTProperties() {
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
    
            const allRealTTokens = await this.getAllRealTTokens();
            
            const realtProperties = propertiesArray
                .filter(property => property?.description?.startsWith("RealT - "))
                .map(property => {
                    // Extract contract address from description (format: 0x...)
                    const contractAddress = property.description.match(/0x[a-fA-F0-9]{40}/)?.[0]?.toLowerCase();
                    
                    // Get token details if contract address is found
                    const tokenDetails = contractAddress 
                        ? allRealTTokens.find(t => t?.uuid?.toLowerCase() === contractAddress)
                        : null;

                    return {
                        ...property,
                        contractAddress,
                        tokenDetails
                    };
                });
    
            console.log(`Found ${realtProperties.length} RealT properties in Finary`);
            return realtProperties;
    
        } catch (error) {
            console.error("Error getting RealT properties from Finary:", error);
            throw error;
        }
    }

    async getWalletRealTTokens(walletAddress) {
        try {
            const allRealTTokens = await this.getAllRealTTokens();
            console.log("Raw RealT tokens:", allRealTTokens);

            if (!Array.isArray(allRealTTokens)) {
                throw new Error("Format de données RealT invalide");
            }

            const realTContractAddresses = allRealTTokens
                .filter(token => token?.uuid)
                .map(token => token.uuid.toLowerCase());

            console.log("RealT Contract addresses:", realTContractAddresses);

            const response = await fetch(
                `https://blockscout.com/xdai/mainnet/api?module=account&action=tokenlist&address=${walletAddress}`
            );
            
            if (!response.ok) {
                throw new Error(`Erreur Blockscout API: ${response.status}`);
            }

            const data = await response.json();
            console.log("Blockscout tokens:", data.result);

            const walletTokens = data.result.reduce((acc, tx) => {
                if (!tx?.contractAddress) return acc;
                
                const contractAddress = tx.contractAddress.toLowerCase();
                console.log(`Checking token: ${contractAddress}`);
                console.log(`Is RealT token: ${realTContractAddresses.includes(contractAddress)}`);

                if (realTContractAddresses.includes(contractAddress)) {
                    const realTDetails = allRealTTokens.find(t => 
                        t?.uuid?.toLowerCase() === contractAddress
                    );
                    
                    console.log(`Found RealT details:`, realTDetails);

                    if (!acc[contractAddress]) {
                        const balance = tx.balance 
                            ? parseFloat(tx.balance) / Math.pow(10, parseInt(tx.decimals || tx.tokenDecimal))
                            : 0;
                        
                        console.log(`Token balance parsing:`, {
                            token: tx.name,
                            rawBalance: tx.balance,
                            decimals: tx.decimals || tx.tokenDecimal,
                            calculatedBalance: balance
                        });

                        acc[contractAddress] = {
                            contractAddress,
                            tokenName: tx.name || '',
                            tokenSymbol: tx.symbol || '',
                            balance: balance,
                            realTDetails
                        };
                    }
                }
                return acc;
            }, {});
            console.log("Wallet RealT tokens:", walletTokens);
            
            return Object.values(walletTokens)
                .filter(token => token.balance > 0)
                .map(token => ({
                    ...token,
                    balance: parseFloat(token.balance.toFixed(6))
                }));

        } catch (error) {
            console.error("Error getting wallet RealT tokens:", error);
            throw error;
        }
    }

    async getWalletRealTTokens_realestate(walletAddress) {
        try {
            const allTokens = await this.getWalletRealTTokens(walletAddress);
            return allTokens.filter(token => 
                token.realTDetails?.productType === "real_estate_rental"
            );
        } catch (error) {
            console.error("Error filtering real estate tokens:", error);
            throw error;
        }
    }

    async compareWalletAndFinaryTokens(walletAddress) {
        try {
            // Récupérer les tokens du wallet et de Finary
            const walletTokens = await this.getWalletRealTTokens_realestate(walletAddress);
            const finaryTokens = await this.getFinaryRealTProperties();
    
            console.log('Comparing tokens:', {
                wallet: walletTokens.length,
                finary: finaryTokens.length
            });
    
            // Identifier les tokens à mettre à jour, supprimer et ajouter
            const updates = this.findTokensToUpdate(walletTokens, finaryTokens);
            console.log('Token changes needed:', updates);
    
            return updates;
        } catch (error) {
            console.error('Error comparing tokens:', error);
            throw error;
        }
    }
    
    findTokensToUpdate(walletTokens, finaryTokens) {
        const toUpdate = [];
        const toDelete = [];
        const toAdd = [];
    
        // Tokens à mettre à jour ou supprimer
        finaryTokens.forEach(finaryToken => {
            const walletToken = walletTokens.find(wt => 
                wt.contractAddress.toLowerCase() === finaryToken.contractAddress?.toLowerCase()
            );
    
            if (walletToken) {
                toUpdate.push({
                    finary: finaryToken,
                    wallet: walletToken
                });
            } else {
                toDelete.push(finaryToken);
            }
        });
    
        // Nouveaux tokens à ajouter
        walletTokens.forEach(walletToken => {
            const exists = finaryTokens.some(ft => 
                ft.contractAddress?.toLowerCase() === walletToken.contractAddress.toLowerCase()
            );
            if (!exists) {
                toAdd.push(walletToken);
            }
        });
    
        return { toUpdate, toDelete, toAdd };
    }
    
    async syncWalletWithFinary(walletAddress, finaryClient) {
        try {
            console.log('Starting sync for wallet:', walletAddress);
            
            const { toUpdate, toDelete, toAdd } = await this.compareWalletAndFinaryTokens(walletAddress);
    
            // Mettre à jour les tokens existants
            for (const item of toUpdate) {
                await finaryClient.updateRealEstateAsset({
                    id: item.finary.id,
                    name: item.wallet.tokenName,
                    value: item.wallet.realTDetails.netAssetValue * item.wallet.balance,
                    quantity: item.wallet.balance,
                    currency: 'USD',
                    description: `RealT - ${item.wallet.tokenName} (${item.wallet.contractAddress})`
                });
            }
    
            // Supprimer les tokens qui ne sont plus dans le wallet
            for (const token of toDelete) {
                await finaryClient.deleteRealEstateAsset(token.id);
            }
    
            // Ajouter les nouveaux tokens
            for (const token of toAdd) {
                await finaryClient.addRealEstateAsset({
                    name: token.tokenName,
                    value: token.realTDetails.netAssetValue * token.balance,
                    quantity: token.balance,
                    currency: 'USD',
                    category: 'tokenized',
                    description: `RealT - ${token.tokenName} (${token.contractAddress})`
                });
            }
    
            return {
                success: true,
                updated: toUpdate.length,
                deleted: toDelete.length,
                added: toAdd.length
            };
    
        } catch (error) {
            console.error('Sync error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}
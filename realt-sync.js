import { FinaryClient } from "./api.js";

export class RealTSync {
    constructor(realtApiToken) {
        this.realtApiToken = realtApiToken;
        this.realtApiUrl = 'https://api.realtoken.community/v1';
    }

    // Helper function for retrying API calls
    async retryApiCall(fn, maxRetries = 3, retryDelay = 2000, retryCount = 0) {
        try {
            return await fn();
        } catch (error) {
            console.error(`❌ API error (attempt ${retryCount + 1}/${maxRetries}):`, error);
            
            if (retryCount < maxRetries && 
                (error.message.includes('500') || error.message.includes('HTTP error'))) {
                console.log(`⏳ Waiting ${retryDelay/1000}s before retry...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                return this.retryApiCall(fn, maxRetries, retryDelay, retryCount + 1);
            }
            throw error;
        }
    }

    // Normalize contract addresses to lowercase for consistency
    normalizeAddress(address) {
        return address ? address.toLowerCase() : null;
    }

    async syncWalletWithFinary(walletAddresses, finaryClient) {
        let initialCurrency = null;
        let processedTokens = {
            updates: 0,
            deletions: 0,
            additions: 0,
            errors: []
        };
        
        try {
            // If walletAddresses is a string, convert it to an array
            const addresses = Array.isArray(walletAddresses) ? walletAddresses : [walletAddresses];
            console.log('Starting sync for wallets:', addresses);
            
            // Save initial currency and set to USD for RealT tokens
            initialCurrency = await this.handleDisplayCurrency(finaryClient, 'USD');
            console.log('Currency handling completed. Initial currency:', initialCurrency);
            
            // Process each wallet in parallel using Promise.all
            const walletComparisonResults = await Promise.all(
                addresses.map(address => this.compareWalletAndFinaryTokens(address))
            );
            
            // Combine results from all wallets
            const combined = walletComparisonResults.reduce((acc, result) => {
                acc.toUpdate = [...acc.toUpdate, ...result.toUpdate];
                acc.toDelete = [...acc.toDelete, ...result.toDelete];
                acc.toAdd = [...acc.toAdd, ...result.toAdd];
                return acc;
            }, { toUpdate: [], toDelete: [], toAdd: [] });
            
            console.log(`Found ${combined.toUpdate.length} tokens to update, ${combined.toDelete.length} to delete, ${combined.toAdd.length} to add`);
    
            // Process updates
            console.log('\n--- Starting Updates ---');
            await Promise.all(combined.toUpdate.map(async (item) => {
                try {
                    console.log(`\nUpdating token: ${item.wallet.tokenName} (${item.wallet.contractAddress})`);
                    console.log('Current values:', {
                        balance: item.wallet.balance,
                        value: item.wallet.realTDetails.netAssetValue * item.wallet.balance
                    });
                    
                    await finaryClient.updateRealEstateAsset({
                        id: item.finary.id,
                        name: item.wallet.tokenName,
                        value: item.wallet.realTDetails.netAssetValue * item.wallet.balance,
                        quantity: item.wallet.balance,
                        currency: 'USD',
                        description: `RealT - ${item.wallet.tokenName} (${item.wallet.contractAddress})`
                    });
                    processedTokens.updates++;
                    console.log('✅ Update successful');
                } catch (error) {
                    console.error(`❌ Error updating token ${item.wallet.tokenName}:`, error);
                    processedTokens.errors.push({
                        type: 'update',
                        token: item.wallet.tokenName,
                        error: error.message
                    });
                }
            }));
    
            // Process deletions sequentially to avoid rate limiting
            console.log('\n--- Starting Deletions ---');
            for (const token of combined.toDelete) {
                try {
                    console.log(`\nDeleting token: ${token.description}`);
                    await this.retryApiCall(async () => {
                        await finaryClient.deleteRealEstateAsset(token.id);
                        await new Promise(resolve => setTimeout(resolve, 1000)); // Add delay between API calls
                    });
                    processedTokens.deletions++;
                    console.log('✅ Deletion successful');
                } catch (error) {
                    console.error(`❌ Error deleting token ${token.description}:`, error);
                    processedTokens.errors.push({
                        type: 'delete',
                        token: token.description,
                        error: error.message
                    });
                }
            }
    
            // Process additions sequentially to avoid rate limiting
            console.log('\n--- Starting Additions ---');
            for (const token of combined.toAdd) {
                try {
                    console.log(`\nAdding token: ${token.tokenName} (${token.contractAddress})`);
                    console.log('Token details:', {
                        balance: token.balance,
                        price: token.realTDetails.tokenPrice,
                        totalTokens: token.realTDetails.totalTokens,
                        ownership_percentage: (token.balance / token.realTDetails.totalTokens) * 100 
                    });
    
                    await this.validateTokenDetails(token);
                    const tokenDetails = token.realTDetails;
                    
                    await this.retryApiCall(async () => {
                        await finaryClient.addRealEstateAsset({
                            is_automated_valuation: false,
                            is_furnished: false,
                            is_new: false,
                            has_lift: false,
                            has_sauna: false,
                            has_pool: false,
                            flooring_quality: "",
                            flooring_condition: "",
                            windows_quality: "",
                            windows_condition: "",
                            bathrooms_quality: "",
                            bathrooms_condition: "",
                            kitchen_quality: "",
                            kitchen_condition: "",
                            general_quality: "",
                            general_condition: "",
                            parking_spaces: "",
                            garage_spaces: "",
                            number_of_rooms: "",
                            number_of_bathrooms: "",
                            number_of_floors: "",
                            floor_number: "",
                            balcony_area: "",
                            garden_area: "",
                            category: "rent",
                            is_estimable: false,
                            user_estimated_value: (tokenDetails.tokenPrice * tokenDetails.totalTokens),
                            description: `RealT - ${token.tokenName} (${token.contractAddress})`,
                            surface: tokenDetails.squareFeet * 0.09290304, // Convert sq ft to sq m
                            agency_fees: "",
                            notary_fees: "",
                            furnishing_fees: "",
                            renovation_fees: "",
                            buying_price: (tokenDetails.tokenPrice * tokenDetails.totalTokens),
                            building_type: "apartment",
                            ownership_percentage: parseFloat((token.balance / tokenDetails.totalTokens) * 100),
                            place_id: "EjY5ODAgTiBGZWRlcmFsIEh3eSBzdWl0ZSAxMTAsIEJvY2EgUmF0b24sIEZMIDMzNDMyLCBVU0EiJRojChYKFAoSCZdwCUH24diIER1Jcn6F7iQtEglzdWl0ZSAxMTA",
                            monthly_charges: tokenDetails.propertyMaintenanceMonthly || 0,
                            monthly_rent: tokenDetails.netRentMonth || 0,
                            yearly_taxes: tokenDetails.propertyTaxes || 0,
                            rental_period: "annual",
                            rental_type: "nue"
                        });
                        await new Promise(resolve => setTimeout(resolve, 1000)); // Add delay between API calls
                    });
                    processedTokens.additions++;
                    console.log('✅ Addition successful');
                } catch (error) {
                    console.error(`❌ Error adding token ${token.tokenName}:`, error);
                    processedTokens.errors.push({
                        type: 'add',
                        token: token.tokenName,
                        error: error.message
                    });
                }
            }

            // Restore initial currency if different
            if (initialCurrency !== 'USD') {
                console.log(`\nRestoring display currency to ${initialCurrency}`);
                await this.handleDisplayCurrency(finaryClient, initialCurrency);
            }

            console.log('\n--- Sync Summary ---');
            console.log('Processed:', processedTokens);

            return {
                success: true,
                updated: processedTokens.updates,
                deleted: processedTokens.deletions,
                added: processedTokens.additions,
                errors: processedTokens.errors,
                currencyHandled: initialCurrency !== 'USD'
            };

        } catch (error) {
            console.error('\n❌ Sync error:', error);
            
            // Restore initial currency if it was changed
            if (initialCurrency && initialCurrency !== 'USD') {
                try {
                    console.log(`\nAttempting to restore currency to ${initialCurrency}`);
                    await this.handleDisplayCurrency(finaryClient, initialCurrency);
                } catch (currencyError) {
                    console.error('Error restoring currency:', currencyError);
                }
            }
            
            throw error;
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

            // Normalize contract addresses in cache
            const normalizedTokens = tokens.map(token => ({
                ...token,
                uuid: this.normalizeAddress(token.uuid)
            }));

            // Update cache
            await new Promise((resolve) => {
                chrome.storage.local.set({
                    allRealtTokens: normalizedTokens,
                    allRealtTokensTimestamp: now
                }, resolve);
            });

            return normalizedTokens;

        } catch (error) {
            console.error('Error getting RealT tokens:', error);
            throw error;
        }
    }

    async getFinaryRealTProperties() {
        try {
            const finaryClient = new FinaryClient();
            
            // Get and validate token
            const token = await finaryClient.getSessionToken();
            console.log('Token status:', token ? 'Present' : 'Missing');
            
            if (!token) {
                throw new Error("Token Finary non disponible");
            }
    
            // Get real estate assets
            console.log('Fetching real estate assets from Finary...');
            const response = await finaryClient.getRealEstateAssets();
            
            // Validate response structure
            if (!response) {
                throw new Error("Réponse vide de l'API Finary");
            }
    
            if (!response.result) {
                console.error('Invalid response structure:', response);
                throw new Error("Structure de réponse Finary invalide");
            }
    
            // Convert to array if needed
            const propertiesArray = Array.isArray(response.result) 
                ? response.result 
                : (typeof response.result === 'object' ? [response.result] : []);
    
            console.log(`Found ${propertiesArray.length} total properties`);
    
            // Get RealT tokens for comparison
            console.log('Fetching RealT tokens for comparison...');
            const allRealTTokens = await this.getAllRealTTokens();
            
            // Filter and map RealT properties
            const realtProperties = propertiesArray
                .filter(property => {
                    const isRealT = property?.description?.startsWith("RealT - ");
                    if (isRealT) {
                        console.log(`Found RealT property: ${property.description}`);
                    }
                    return isRealT;
                })
                .map(property => {
                    const contractAddress = this.normalizeAddress(
                        property.description.match(/0x[a-fA-F0-9]{40}/)?.[0]
                    );
                    
                    const tokenDetails = contractAddress 
                        ? allRealTTokens.find(t => t?.uuid === contractAddress)
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
            console.error("Stack trace:", error.stack);
            throw error;
        }
    }

    async getWalletRealTTokens(walletAddress) {
        try {
            const allRealTTokens = await this.getAllRealTTokens();

            if (!Array.isArray(allRealTTokens)) {
                throw new Error("Format de données RealT invalide");
            }

            const realTContractAddresses = allRealTTokens
                .filter(token => token?.uuid)
                .map(token => token.uuid);

            const response = await fetch(
                `https://blockscout.com/xdai/mainnet/api?module=account&action=tokenlist&address=${walletAddress}`
            );
            
            if (!response.ok) {
                throw new Error(`Erreur Blockscout API: ${response.status}`);
            }

            const data = await response.json();
            
            // Use a Map for faster lookups
            const tokensMap = new Map();
            
            for (const tx of data.result) {
                if (!tx?.contractAddress) continue;
                
                const contractAddress = this.normalizeAddress(tx.contractAddress);
                
                if (realTContractAddresses.includes(contractAddress)) {
                    const realTDetails = allRealTTokens.find(t => t.uuid === contractAddress);
                    
                    if (!tokensMap.has(contractAddress)) {
                        const balance = tx.balance 
                            ? parseFloat(tx.balance) / Math.pow(10, parseInt(tx.decimals || tx.tokenDecimal))
                            : 0;
                        
                        tokensMap.set(contractAddress, {
                            contractAddress,
                            tokenName: tx.name || '',
                            tokenSymbol: tx.symbol || '',
                            balance: balance,
                            realTDetails
                        });
                    }
                }
            }
            
            return Array.from(tokensMap.values())
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
            // Fetch wallet tokens and Finary tokens in parallel
            const [walletTokens, finaryTokens] = await Promise.all([
                this.getWalletRealTTokens_realestate(walletAddress),
                this.getFinaryRealTProperties()
            ]);
    
            console.log('Comparing tokens:', {
                wallet: walletTokens.length,
                finary: finaryTokens.length
            });
    
            // Identify tokens to update, delete, and add
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
    
        // Create a Map for faster lookups
        const walletTokensMap = new Map(
            walletTokens.map(token => [token.contractAddress, token])
        );
        
        const finaryTokensAddresses = new Set(
            finaryTokens
                .filter(token => token.contractAddress)
                .map(token => token.contractAddress)
        );
    
        // Tokens to update or delete
        for (const finaryToken of finaryTokens) {
            if (!finaryToken.contractAddress) {
                toDelete.push(finaryToken);
                continue;
            }
            
            const walletToken = walletTokensMap.get(finaryToken.contractAddress);
    
            if (walletToken) {
                toUpdate.push({
                    finary: finaryToken,
                    wallet: walletToken
                });
            } else {
                toDelete.push(finaryToken);
            }
        }
    
        // New tokens to add
        for (const walletToken of walletTokens) {
            if (!finaryTokensAddresses.has(walletToken.contractAddress)) {
                toAdd.push(walletToken);
            }
        }
    
        return { toUpdate, toDelete, toAdd };
    }
    
    async handleDisplayCurrency(finaryClient, requiredCurrency) {
        try {
            // Get current display currency
            const userData = await finaryClient.apiRequest("/users/me", "GET");
            const currentCurrency = userData.result.ui_configuration.display_currency.code;
            
            console.log(`Current display currency: ${currentCurrency}`);
            
            if (currentCurrency !== requiredCurrency) {
                console.log(`Updating display currency to ${requiredCurrency}`);
                await finaryClient.updateDisplayCurrency(requiredCurrency);
            }
            
            return currentCurrency;
        } catch (error) {
            console.error('Error handling display currency:', error);
            throw error;
        }
    }

    // Add validation helper method
    async validateTokenDetails(token) {
        const required = [
            'tokenPrice',
            'totalTokens',
            'squareFeet',
            'propertyMaintenanceMonthly',
            'netRentMonth',
            'propertyTaxes'
        ];

        const missing = required.filter(field => 
            !token.realTDetails || !token.realTDetails[field]
        );

        if (missing.length > 0) {
            throw new Error(`Missing required fields for token ${token.tokenName}: ${missing.join(', ')}`);
        }
    }
    
    async deleteAllFinaryRealTTokens(finaryClient) {
        const BETWEEN_CALLS_DELAY = 1000; // Délai entre chaque appel API
    
        try {
            console.log('🔄 Starting deletion of all RealT tokens from Finary...');
    
            // Get properties with retry
            const finaryTokens = await this.retryApiCall(async () => {
                const properties = await this.getFinaryRealTProperties();
                if (!properties) {
                    throw new Error('No RealT properties found in Finary');
                }
                return properties;
            });
    
            console.log(`📝 Found ${finaryTokens.length} RealT tokens to delete`);
    
            let deletedCount = 0;
            let errors = [];
    
            // Delete tokens with retry
            for (const token of finaryTokens) {
                try {
                    await this.retryApiCall(async () => {
                        console.log(`🗑️ Deleting token: ${token.description}`);
                        await finaryClient.deleteRealEstateAsset(token.id);
                        await new Promise(resolve => setTimeout(resolve, BETWEEN_CALLS_DELAY));
                    });
                    
                    deletedCount++;
                    console.log(`✅ Successfully deleted: ${token.description}`);
                } catch (error) {
                    console.error(`❌ Failed to delete ${token.description}:`, error);
                    errors.push({
                        token: token.description,
                        error: error.message
                    });
                }
            }
    
            const summary = {
                success: true,
                totalTokens: finaryTokens.length,
                deletedTokens: deletedCount,
                errors: errors
            };
    
            console.log('📊 Deletion Summary:', summary);
            return summary;
    
        } catch (error) {
            console.error('❌ Fatal error during deletion:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}
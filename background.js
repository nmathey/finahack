import { handleMenuClick } from './actions.js';
import { FinaryClient } from './api.js';

// Initialize context menus
const initializeMenus = () => {
    console.log("🛠️ Extension installée, création des menus...");
    const menuItems = [
        { id: "getHoldingsAccounts", title: "Télécharger tout le portefeuille" },
        { id: "exportFlattenedAssets", title: "Exporter assets aplatis (CSV)" },
        { id: "manageVirtualEnvelop", title: "Gérer myAssetType & virtual_envelop (assets)" },
        { id: "analyzeEtfOverlap", title: "Analyser l'overlap des ETFs" },
        { id: "setRealTWallet", title: "Paramêtre pour RealT" },
        { id: "syncRealTokenFinary", title: "Sync les RealToken sur Finary" },
        { id: "deleteAllRealTokenFinary", title: "Supprimer tous les RealToken de Finary"}
    ];
    
    menuItems.forEach(item => {
        chrome.contextMenus.create({
            id: item.id,
            title: item.title,
            contexts: ["all"]
        });
    });
};

// Initialize extension
chrome.runtime.onInstalled.addListener(initializeMenus);

// Handle menu clicks
chrome.contextMenus.onClicked.addListener(handleMenuClick);

// Allow popup to request a forced refresh of flattened holdings cache
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.action === 'FORCE_REFRESH_FLATTENED') {
        (async () => {
            try {
                const finaryClient = new FinaryClient();
                const membershipId = await finaryClient.getSelectedMembershipId();
                const organizationId = await finaryClient.getSelectedOrganization();
                if (!membershipId || !organizationId) {
                    sendResponse({ error: 'Missing organization or membership' });
                    return;
                }

                const fetched = await finaryClient.getFlattenedCurrentHoldingsAccounts(organizationId, membershipId);
                if (!fetched || !Array.isArray(fetched)) {
                    sendResponse({ error: 'Empty fetched flattened assets' });
                    return;
                }

                // merge preserving virtual_envelop
                const existing = await new Promise(res => chrome.storage.local.get(['flattened_holdings_cache'], res));
                const existingArr = Array.isArray(existing.flattened_holdings_cache) ? existing.flattened_holdings_cache : [];
                const existingMap = new Map();
                existingArr.forEach(it => existingMap.set(String(it.assetId ?? it.id ?? it.holdingId ?? ''), it));

                const normalized = (fetched || []).map(it => {
                    const assetIdRaw = it.id ?? it.assetId ?? it.asset_id ?? '';
                    return {
                        holdingId: it.holdingId ?? it.holding_id ?? it.holdingId ?? '',
                        accountName: it.accountName ?? it.account_name ?? it.accountName ?? '',
                        institutionName: it.institutionName ?? it.institution_name ?? it.institutionName ?? '',
                        envelopeType: it.envelopeType ?? it.envelope_type ?? it.envelopeType ?? '',
                        assetId: String(assetIdRaw),
                        assetName: it.name ?? it.assetName ?? it.asset_name ?? '',
                        assetType: it.assetType ?? it.type ?? '',
                        category: it.category ?? '',
                        subcategory: it.subcategory ?? '',
                        currentValue: it.currentValue ?? it.display_current_value ?? null,
                        quantity: it.quantity ?? null,
                        pnl_amount: it.pnl_amount ?? it.display_unrealized_pnl ?? null
                    };
                }).filter(Boolean);

                const merged = normalized.map(n => {
                    const prev = existingMap.get(String(n.assetId));
                    const myAssetType = (prev && prev.myAssetType) ? prev.myAssetType : (n.assetType || '');
                    const virtual_envelop = (prev && prev.virtual_envelop) ? prev.virtual_envelop : (n.accountName || '');
                    return { ...n, myAssetType, virtual_envelop };
                });

                await new Promise(res => chrome.storage.local.set({ flattened_holdings_cache: merged, flattened_holdings_cache_ts: Date.now() }, res));
                sendResponse({ success: true, count: merged.length });
            } catch (err) {
                console.error('Error in FORCE_REFRESH_FLATTENED:', err);
                sendResponse({ error: err.message || String(err) });
            }
        })();
        return true; // async
    }
});
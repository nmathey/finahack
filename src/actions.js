import { FinaryClient } from './api.js';

export async function handleMenuClick(info) {
  const finaryClient = new FinaryClient();
  const token = await finaryClient.getSessionToken();
  if (!token) {
    console.error('Token de session non disponible');
    return;
  }
  if (info.menuItemId === 'showAssetsSummary') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) {
        console.error('Aucun onglet actif trouvé.');
        return;
      }

      chrome.scripting.executeScript(
        {
          target: { tabId: tabs[0].id },
          files: ['consolidateAssets.js'],
        },
        () => {
          if (chrome.runtime.lastError) {
            console.error(
              "Erreur lors de l'injection du script:",
              chrome.runtime.lastError
            );
          } else {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'openAssetsModal' });
          }
        }
      );
    });
  } else if (info.menuItemId === 'exportFlattenedAssets') {
    // Open export popup with flag to export flattened assets
    chrome.windows.create({
      url: chrome.runtime.getURL('src/popup_export.html') + '?flattened=1',
      type: 'popup',
      width: 500,
      height: 400,
    });
  } else if (info.menuItemId === 'manageVirtualEnvelop') {
    try {
      const membershipId = await finaryClient.getSelectedMembershipId();
      const organizationId = await finaryClient.getSelectedOrganization();
      if (!membershipId || !organizationId) {
        console.error('Impossible de récupérer organization/membership');
        return;
      }

      // Helpers for chrome.storage with promises
      const getStorage = (keys) =>
        new Promise((res) => chrome.storage.local.get(keys, res));
      const setStorage = (obj) =>
        new Promise((res) => chrome.storage.local.set(obj, res));

      // Check existing cache and timestamp
      const existing = await getStorage([
        'flattened_holdings_cache',
        'flattened_holdings_cache_ts',
      ]);
      const existingCache = Array.isArray(existing.flattened_holdings_cache)
        ? existing.flattened_holdings_cache
        : [];
      const ts = existing.flattened_holdings_cache_ts || 0;
      const now = Date.now();
      const DAY_MS = 24 * 60 * 60 * 1000;

      // If cache exists and not expired, use it directly (no API call)
      let newFlattened;
      if (existingCache.length > 0 && now - ts < DAY_MS) {
        console.log('[actions] using cached flattened holdings (fresh)');
        newFlattened = existingCache;
      } else {
        // fetch fresh flattened list from API
        const fetched = await finaryClient.getFlattenedCurrentHoldingsAccounts(
          organizationId,
          membershipId
        );
        if (!fetched || !Array.isArray(fetched)) {
          console.error('Aucun asset aplati récupéré');
          return;
        }
        newFlattened = fetched;
      }

      // Merge: normalize fields and preserve virtual_envelop from existingCache when assetId matches
      const existingMap = new Map();
      existingCache.forEach((it) => {
        const existingKey = String(
          it.assetId ?? it.id ?? it.holdingId ?? it.asset_id ?? ''
        );
        if (existingKey) existingMap.set(existingKey, it);
      });

      const normalizedNew = (newFlattened || [])
        .map((it) => {
          const assetIdRaw = it.id ?? it.assetId ?? it.asset_id ?? '';
          if (!assetIdRaw) return null;
          return {
            holdingId: it.holdingId ?? it.holding_id ?? it.holdingId ?? '',
            accountName:
              it.accountName ?? it.account_name ?? it.accountName ?? '',
            institutionName:
              it.institutionName ??
              it.institution_name ??
              it.institutionName ??
              '',
            envelopeType:
              it.envelopeType ?? it.envelope_type ?? it.envelopeType ?? '',
            assetId: String(assetIdRaw),
            assetName: it.name ?? it.assetName ?? it.asset_name ?? '',
            assetType: it.assetType ?? it.type ?? '',
            category: it.category ?? '',
            subcategory: it.subcategory ?? '',
            currentValue: it.currentValue ?? it.display_current_value ?? null,
            quantity: it.quantity ?? null,
            pnl_amount: it.pnl_amount ?? it.display_unrealized_pnl ?? null,
          };
        })
        .filter(Boolean);

      const merged = normalizedNew.map((n) => {
        const prev = existingMap.get(String(n.assetId));
        const myAssetType =
          prev && prev.myAssetType ? prev.myAssetType : n.assetType || '';
        const virtual_envelop =
          prev && prev.virtual_envelop
            ? prev.virtual_envelop
            : n.accountName || '';
        return { ...n, myAssetType, virtual_envelop };
      });

      // Persist merged cache with timestamp
      await setStorage({
        flattened_holdings_cache: merged,
        flattened_holdings_cache_ts: Date.now(),
      });

      // Open popup to manage
      chrome.windows.create({
        url: chrome.runtime.getURL('src/popup_virtual_envelop.html'),
        type: 'popup',
        width: 900,
        height: 600,
      });
    } catch (err) {
      console.error('Error preparing flattened cache:', err);
    }
  } else if (info.menuItemId === 'visualizeMyAssetType') {
    // Open popup to visualize distribution by myAssetType
    chrome.windows.create({
      url: chrome.runtime.getURL('src/popup_myasset_distribution.html'),
      type: 'popup',
      width: 900,
      height: 700,
    });
  }
}

import { handleMenuClick } from './actions.js';
import { FinaryClient } from './api.js';

const initializeMenus = () => {
  console.log('🛠️ Extension installed, creating menus...');
  const menuItems = [
    { id: 'exportFlattenedAssets', title: 'Export flattened assets (CSV)' },
    { id: 'manageVirtualEnvelop', title: 'Manage myAssetType & virtual_envelop (assets)' },
    { id: 'visualizeMyAssetType', title: 'Visualize distribution by myAssetType' },
  ];

  menuItems.forEach((item) => {
    chrome.contextMenus.create({
      id: item.id,
      title: item.title,
      contexts: ['all'],
    });
  });
};

const handleForceRefresh = async () => {
  const finaryClient = new FinaryClient();
  const membershipId = await finaryClient.getSelectedMembershipId();
  const organizationId = await finaryClient.getSelectedOrganization();
  if (!membershipId || !organizationId) {
    throw new Error('Missing organization or membership');
  }

  const fetched = await finaryClient.getFlattenedCurrentHoldingsAccounts(organizationId, membershipId);
  if (!fetched || !Array.isArray(fetched)) {
    throw new Error('Empty fetched flattened assets');
  }

  const { flattened_holdings_cache: existingArr = [] } = await new Promise((res) =>
    chrome.storage.local.get('flattened_holdings_cache', res)
  );
  const existingMap = new Map(existingArr.map((it) => [String(it.assetId ?? it.id ?? it.holdingId ?? ''), it]));

  const normalized = fetched.map((it) => {
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
      pnl_amount: it.pnl_amount ?? it.display_unrealized_pnl ?? null,
    };
  });

  const merged = normalized.map((n) => {
    const prev = existingMap.get(String(n.assetId));
    return {
      ...n,
      myAssetType: prev?.myAssetType || n.assetType || '',
      virtual_envelop: prev?.virtual_envelop || n.accountName || '',
    };
  });

  await new Promise((res) =>
    chrome.storage.local.set(
      {
        flattened_holdings_cache: merged,
        flattened_holdings_cache_ts: Date.now(),
      },
      res
    )
  );

  return { success: true, count: merged.length };
};

chrome.runtime.onInstalled.addListener(initializeMenus);
chrome.contextMenus.onClicked.addListener(handleMenuClick);
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.action === 'FORCE_REFRESH_FLATTENED') {
    handleForceRefresh()
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message || String(err) }));
    return true;
  }
});

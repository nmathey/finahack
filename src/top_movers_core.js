import { FinaryClient } from './api.js';

/**
 * Fetches the current asset data and returns it as a snapshot.
 * @returns {Promise<Array>} A promise that resolves to the flattened asset list.
 */
async function getAssetSnapshot() {
  const finary = new FinaryClient();
  const organizationId = await finary.getSelectedOrganization();
  if (!organizationId) {
    console.error('Could not retrieve organization ID.');
    return [];
  }
  const membershipId = await finary.getSelectedMembershipId();
  if (!membershipId) {
    console.error('Could not retrieve membership ID.');
    return [];
  }
  return await finary.getFlattenedCurrentHoldingsAccounts(
    organizationId,
    membershipId
  );
}

/**
 * Stores the given asset snapshot in chrome.storage.local.
 * @param {Array} snapshot The asset snapshot to store.
 * @returns {Promise<void>}
 */
function storeAssetSnapshot(snapshot) {
  const dataToStore = {
    timestamp: new Date().toISOString(),
    assets: snapshot,
  };
  return new Promise((resolve) => {
    chrome.storage.local.set({ assetSnapshot: dataToStore }, () => {
      console.log('New asset snapshot stored.');
      resolve();
    });
  });
}

/**
 * Retrieves the last stored asset snapshot from chrome.storage.local.
 * @returns {Promise<Object|null>} A promise that resolves to the stored snapshot or null if not found.
 */
function getStoredAssetSnapshot() {
  return new Promise((resolve) => {
    chrome.storage.local.get('assetSnapshot', (result) => {
      if (result.assetSnapshot) {
        console.log('Retrieved stored asset snapshot.');
        resolve(result.assetSnapshot);
      } else {
        console.log('No asset snapshot found in storage.');
        resolve(null);
      }
    });
  });
}

/**
 * Compares two asset snapshots and calculates value changes.
 * @param {Array} oldAssets The array of assets from the old snapshot.
 * @param {Array} newAssets The array of assets from the new snapshot.
 * @returns {Array} An array of objects representing the changes.
 */
function compareSnapshots(oldAssets, newAssets) {
  const changes = [];
  const oldAssetsMap = new Map(oldAssets.map((asset) => [asset.id, asset]));

  newAssets.forEach((newAsset) => {
    const oldAsset = oldAssetsMap.get(newAsset.id);
    if (oldAsset) {
      const valueChange = newAsset.currentValue - oldAsset.currentValue;
      if (valueChange !== 0) {
        changes.push({
          ...newAsset,
          valueChange: valueChange,
        });
      }
    }
  });

  return changes;
}

/**
 * Calculates the top movers from a list of changes.
 * @param {Array} changes The array of asset changes.
 * @returns {Object} An object containing the top movers for assets, envelopes, and classes.
 */
function calculateTopMovers(changes) {
  const movers = {
    assets: { gainers: [], losers: [] },
    envelopes: { gainers: [], losers: [] },
    classes: { gainers: [], losers: [] },
  };

  // Assets
  const sortedAssets = [...changes].sort(
    (a, b) => b.valueChange - a.valueChange
  );
  movers.assets.gainers = sortedAssets.slice(0, 5);
  movers.assets.losers = sortedAssets.slice(-5).reverse();

  // Envelopes
  const envelopeChanges = changes.reduce((acc, change) => {
    acc[change.accountName] =
      (acc[change.accountName] || 0) + change.valueChange;
    return acc;
  }, {});

  const sortedEnvelopes = Object.entries(envelopeChanges)
    .sort(([, a], [, b]) => b - a)
    .map(([name, valueChange]) => ({ name, valueChange }));

  movers.envelopes.gainers = sortedEnvelopes.slice(0, 5);
  movers.envelopes.losers = sortedEnvelopes.slice(-5).reverse();

  // Asset Classes
  const classChanges = changes.reduce((acc, change) => {
    acc[change.category] = (acc[change.category] || 0) + change.valueChange;
    return acc;
  }, {});

  const sortedClasses = Object.entries(classChanges)
    .sort(([, a], [, b]) => b - a)
    .map(([name, valueChange]) => ({ name, valueChange }));

  movers.classes.gainers = sortedClasses.slice(0, 5);
  movers.classes.losers = sortedClasses.slice(-5).reverse();

  return movers;
}

/**
 * Main function to get the top movers report.
 * It fetches new data, compares with stored data, and stores the new data.
 * @returns {Promise<Object>} The top movers report.
 */
export async function getTopMovers() {
  const oldSnapshot = await getStoredAssetSnapshot();
  const newSnapshot = await getAssetSnapshot();

  if (!newSnapshot || newSnapshot.length === 0) {
    return { error: 'Could not fetch new asset data.' };
  }

  // Always store the new snapshot for the next comparison
  await storeAssetSnapshot(newSnapshot);

  if (!oldSnapshot) {
    return {
      message:
        'This is the first run. Data has been saved for the next comparison.',
    };
  }

  const changes = compareSnapshots(oldSnapshot.assets, newSnapshot);
  const topMovers = calculateTopMovers(changes);

  return {
    ...topMovers,
    oldTimestamp: oldSnapshot.timestamp,
    newTimestamp: new Date().toISOString(),
  };
}

import { FinaryClient } from './api.js';

/**
 * Fetches the current asset data and returns it as a snapshot.
 * @returns {Promise<Array>} A promise that resolves to the flattened asset list.
 */
export async function getAssetSnapshot() {
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
 * Adds a new asset snapshot to the history in chrome.storage.local.
 * @param {Array} snapshot The asset snapshot to store.
 * @returns {Promise<void>}
 */
export async function addAssetSnapshotToHistory(snapshot) {
  const newSnapshot = {
    timestamp: new Date().toISOString(),
    assets: snapshot,
  };

  const history = await getAssetSnapshotHistory();
  history.push(newSnapshot);

  // Prune snapshots older than one year
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const prunedHistory = history.filter(
    (snap) => new Date(snap.timestamp) > oneYearAgo
  );

  return new Promise((resolve) => {
    chrome.storage.local.set({ assetSnapshotHistory: prunedHistory }, () => {
      console.log('New asset snapshot added to history.');
      resolve();
    });
  });
}

/**
 * Retrieves the asset snapshot history from chrome.storage.local.
 * @returns {Promise<Array>} A promise that resolves to the snapshot history.
 */
function getAssetSnapshotHistory() {
  return new Promise((resolve) => {
    chrome.storage.local.get('assetSnapshotHistory', (result) => {
      if (result.assetSnapshotHistory) {
        resolve(result.assetSnapshotHistory);
      } else {
        resolve([]);
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
 * @param {string} timeRange - The time range for the report ('last_sync', 'week', 'month', 'year').
 * @returns {Promise<Object>} The top movers report.
 */
export async function getTopMovers(timeRange = 'last_sync') {
  const history = await getAssetSnapshotHistory();
  const latestSnapshot = history[history.length - 1];
  let oldSnapshot;

  if (timeRange === 'last_sync') {
    oldSnapshot = history[history.length - 2];
  } else {
    const now = new Date();
    let targetDate = new Date();

    if (timeRange === 'week') {
      targetDate.setDate(now.getDate() - 7);
    } else if (timeRange === 'month') {
      targetDate.setMonth(now.getMonth() - 1);
    } else if (timeRange === 'year') {
      targetDate.setFullYear(now.getFullYear() - 1);
    }

    // Find the snapshot closest to the target date
    oldSnapshot = history.reduce((prev, curr) => {
      const currDate = new Date(curr.timestamp);
      const prevDate = new Date(prev.timestamp);
      return Math.abs(currDate - targetDate) < Math.abs(prevDate - targetDate)
        ? curr
        : prev;
    });
  }

  if (!latestSnapshot || !oldSnapshot) {
    return {
      message: 'Not enough data to generate a report for this time range.',
    };
  }

  const changes = compareSnapshots(oldSnapshot.assets, latestSnapshot.assets);
  const topMovers = calculateTopMovers(changes);

  return {
    ...topMovers,
    oldTimestamp: oldSnapshot.timestamp,
    newTimestamp: latestSnapshot.timestamp,
  };
}

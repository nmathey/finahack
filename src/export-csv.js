import { FinaryClient } from '../api.js';

/**
 * Exporte tous les holdings Finary de l'utilisateur courant au format CSV.
 */
export async function exportFinaryHoldingsToCSV() {
    const finaryClient = new FinaryClient();

    const membershipId = await finaryClient.getSelectedMembershipId();
    const organizationId = await finaryClient.getSelectedOrganization();
    if (!membershipId || !organizationId) {
        alert("Impossible de récupérer les identifiants Finary.");
        return;
    }

    const accounts = await finaryClient.getCurrentHoldingsAccounts(organizationId, membershipId);
    if (!accounts || !Array.isArray(accounts)) {
        alert("Aucun compte de holdings trouvé.");
        return;
    }

    // Générer le CSV
    let csvString = "account_name,asset_name,symbol,current_price,buying_price,quantity,currency,type\n";
    const addLine = (line) => { csvString += line; };

    // Fonctions d'export pour chaque type d'asset
    function printFiat(account, item) {
        addLine(`${account.slug},${item.fiat.name},${item.fiat.code},1.0,0,${item.quantity},${item.fiat.code},FIAT\n`);
    }
    function printSecurity(account, item) {
        addLine(`${account.slug},${item.security.name},${item.security.isin},${item.security.display_current_price},${item.display_buying_price},${item.quantity},${item.security.display_currency.code},${item.security.security_type}\n`);
    }
    function printCrowdlending(account, item) {
        addLine(`${account.slug},${item.name},${item.name},${item.display_current_price},${item.display_initial_investment},1.0,${item.currency.code},CROWDLENDING\n`);
    }
    function printCrypto(account, item) {
        addLine(`${account.slug},${item.crypto.name},${item.crypto.code},${item.display_current_price},${item.display_buying_price},${item.quantity},${item.buying_price_currency.code},CRYPTO\n`);
    }
    function printFondEuro(account, item) {
        addLine(`${account.slug},${item.name},,${item.display_current_price},0.0,1.0,${item.currency.code},FOND_EURO\n`);
    }
    function printPreciousMetal(account, item) {
        addLine(`${account.slug},${item.precious_metal.name},,${item.precious_metal.display_current_price},${item.display_buying_price},${item.quantity},${item.precious_metal.currency.code},PRECIOUS_METAL\n`);
    }
    function printStartup(account, item) {
        addLine(`${account.slug},${item.startup.name},,${item.display_user_estimated_price},${item.display_buying_price},${item.shares},${item.currency.code},STARTUP\n`);
    }
    function printSCPI(account, item) {
        addLine(`${account.slug},${item.scpi.name},,${item.scpi.display_current_price},${item.display_buying_price},${item.shares},${item.scpi.currency.code},${item.scpi.scpi_type}\n`);
    }
    function printGenericAsset(account, item) {
        addLine(`${account.slug},${item.name},,${item.display_current_price},${item.display_buying_price},${item.quantity},${item.currency.code},${item.category}\n`);
    }
    function printRealEstate(account, item) {
        addLine(`${account.slug},${item.slug},,${item.display_current_value},${item.display_buying_price},1.0,${account.currency.code},REAL_ESTATE\n`);
    }

    accounts.forEach(account => {
        if (account.fiats) account.fiats.forEach(item => printFiat(account, item));
        if (account.securities) account.securities.forEach(item => printSecurity(account, item));
        if (account.crowdlendings) account.crowdlendings.forEach(item => printCrowdlending(account, item));
        if (account.cryptos) account.cryptos.forEach(item => printCrypto(account, item));
        if (account.fonds_euro) account.fonds_euro.forEach(item => printFondEuro(account, item));
        if (account.precious_metals) account.precious_metals.forEach(item => printPreciousMetal(account, item));
        if (account.startups) account.startups.forEach(item => printStartup(account, item));
        if (account.scpis) account.scpis.forEach(item => printSCPI(account, item));
        if (account.generic_assets) account.generic_assets.forEach(item => printGenericAsset(account, item));
        if (account.real_estates) account.real_estates.forEach(item => printRealEstate(account, item));
    });

    // Télécharger le CSV
    const a = document.createElement('a');
    const date = new Date().toISOString().replaceAll(/-|:|Z/g, "").replace("T", "_").substr(0, 15);
    a.download = `finary_${date}.csv`;
    a.href = URL.createObjectURL(new Blob([csvString], { type: 'text/csv' }));
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
    }, 30000);
}

/**
 * Exporte les assets aplatis (utilise flattenAssets via FinaryClient.getFlattenedCurrentHoldingsAccounts)
 */
export async function exportFlattenedAssetsToCSV() {
    const finaryClient = new FinaryClient();

    const membershipId = await finaryClient.getSelectedMembershipId();
    const organizationId = await finaryClient.getSelectedOrganization();
    if (!membershipId || !organizationId) {
        alert("Impossible de récupérer les identifiants Finary.");
        return;
    }

    const flattened = await finaryClient.getFlattenedCurrentHoldingsAccounts(organizationId, membershipId);
    if (!flattened || !Array.isArray(flattened) || flattened.length === 0) {
        alert("Aucun asset aplati trouvé.");
        return;
    }

    // Générer le CSV depuis la structure aplatie
    let csvString = "holdingId,accountName,institutionName,envelopeType,assetId,assetName,assetType,category,subcategory,currentValue,quantity,pnl_amount\n";
    const addLine = (line) => { csvString += line; };

    flattened.forEach(item => {
        const line = [
            item.holdingId ?? '',
            (item.accountName || '').replace(/,/g, ' '),
            (item.institutionName || '').replace(/,/g, ' '),
            item.envelopeType ?? '',
            item.id ?? '',
            (item.name || '').replace(/,/g, ' '),
            item.assetType ?? '',
            item.category ?? '',
            item.subcategory ?? '',
            item.currentValue ?? '',
            item.quantity ?? '',
            item.pnl_amount ?? ''
        ].join(',') + '\n';
        addLine(line);
    });

    const a = document.createElement('a');
    const date = new Date().toISOString().replaceAll(/-|:|Z/g, "").replace("T", "_").substr(0, 15);
    a.download = `finary_flattened_${date}.csv`;
    a.href = URL.createObjectURL(new Blob([csvString], { type: 'text/csv' }));
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
    }, 30000);
}
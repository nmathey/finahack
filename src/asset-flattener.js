/**
 * Transforme la réponse hiérarchique des holdings de l'API Finary en une liste plate d'actifs.
 */
function flattenAssets(apiResponse) {
  if (!apiResponse || !apiResponse.result) {
    console.error('Format de réponse API invalide', apiResponse);
    return [];
  }

  const flattenedAssets = [];

  apiResponse.result.forEach((holding) => {
    // --- 1. Contexte du Holding (Enveloppe) ---
    let envelopeType = 'unknown';
    const typeSlug = holding.bank_account_type?.slug || '';
    const holdingsAccountSubtype =
      holding.holdings_account_type?.account_subtype || '';
    const holdingsAccountType =
      holding.holdings_account_type?.account_type || '';

    if (typeSlug.includes('lifeinsurance')) envelopeType = 'av';
    else if (typeSlug.includes('pea')) envelopeType = 'pea';
    else if (typeSlug.includes('pee')) envelopeType = 'pee';
    else if (
      typeSlug.includes('compte_titres') ||
      typeSlug.includes('brokerage')
    )
      envelopeType = 'cto';
    else if (typeSlug.includes('savings') || typeSlug.includes('checking'))
      envelopeType = 'bank';
    else if (holding.manual_type === 'real_estate')
      envelopeType = 'direct_real_estate';
    else if (holding.manual_type === 'scpi') envelopeType = 'scpi';
    else if (holding.manual_type === 'commodities') envelopeType = 'commodities';
    else if (
      holdingsAccountSubtype === 'generic_asset' ||
      holdingsAccountType === 'other'
    )
      envelopeType = 'other';
    else if (!holding.bank_account_type) envelopeType = 'crypto_wallet';

    const baseInfo = {
      holdingId: holding.id,
      accountName: holding.name,
      institutionName:
        holding.institution?.name || holding.bank?.name || 'Autre',
      envelopeType: envelopeType,
    };

    // Helper pour ajouter un actif uniformisé
    const pushAsset = (
      id,
      name,
      assetClass,
      assetType,
      assetVehicle,
      value,
      quantity,
      pnl
    ) => {
      // On ignore les actifs sans valeur pour éviter le bruit, sauf si tu veux tout voir
      // if (!value && value !== 0) return;

      flattenedAssets.push({
        ...baseInfo,
        id: id,
        name: name,
        assetClass: assetClass, 
        assetType: assetType, 
        assetVehicle: assetVehicle,
        // Marqueurs pour l'UI indiquant que ces champs sont éditables
        assetClass_editable: true,
        assetType_editable: true,
        assetVehicle_editable: true,
        currentValue: value,
        quantity: quantity,
        pnl_amount: pnl,
      });
    };

    // --- 2. Traitement des CRYPTOS ---
    if (holding.cryptos) {
      holding.cryptos.forEach((c) => {
        let category = 'crypto';
        let subcategory = 'coin';
        let name = c.crypto.name || c.crypto.code;
        pushAsset(
          c.id,
          name,
          'crypto',
          category,
          subcategory,
          c.display_current_value,
          c.quantity,
          c.display_unrealized_pnl
        );
      });
    }

    // --- 3. Traitement des SECURITIES (Actions/ETF) ---
    if (holding.securities) {
      holding.securities.forEach((s) => {
        const isEtf = s.security.security_type === 'etf';
        pushAsset(
          s.id,
          s.security.name,
          'security',
          isEtf ? 'fund' : 'stock',
          s.security.security_type,
          s.display_current_value,
          s.quantity,
          s.display_unrealized_pnl
        );
      });
    }

    // --- 4. Immobilier Physique ---
    if (holding.real_estates) {
      holding.real_estates.forEach((re) => {
        pushAsset(
          re.id,
          re.address_formatted || holding.name,
          'real_estate',
          'real_estate',
          'physical',
          re.display_current_value,
          1,
          re.display_unrealized_pnl
        );
      });
    }

    // --- 5. SCPI ---
    if (holding.scpis) {
      holding.scpis.forEach((s) => {
        pushAsset(
          s.id,
          s.scpi.name,
          'scpi',
          'real_estate',
          'paper',
          s.display_current_value,
          s.shares,
          s.display_unrealized_pnl
        );
      });
    }

    // --- 6. Cash / Fiat ---
    if (holding.fiats) {
      holding.fiats.forEach((f) => {
        pushAsset(
          f.id,
          holding.name,
          'fiat',
          'fiat',
          'cash',
          f.display_current_value,
          f.quantity,
          0
        );
      });
    }

    // --- 7. Fonds Euro ---
    if (holding.fonds_euro) {
      holding.fonds_euro.forEach((fe) => {
        pushAsset(
          fe.id,
          fe.fund?.name || fe.name || 'Fonds Euro',
          'fonds_euro',
          'fund',
          'guaranteed',
          fe.display_current_value,
          fe.quantity,
          fe.display_unrealized_pnl
        );
      });
    }

    // --- 8. Métaux précieux ---
    if (holding.precious_metals) {
      holding.precious_metals.forEach((pm) => {
        const preciousMetal = pm.precious_metal || pm.valuable || {};
        pushAsset(
          pm.id,
          preciousMetal.name || pm.name || 'Métal précieux',
          'Matières premières',
          'Physique',
          'Physique',
          pm.display_current_value,
          pm.quantity,
          pm.display_unrealized_pnl
        );
      });
    }

    // --- 9. Startups ---
    if (holding.startups) {
      holding.startups.forEach((s) => {
        pushAsset(
          s.id,
          s.startup.name,
          'startup',
          'startup',
          'private_equity',
          s.display_current_value,
          s.shares,
          s.display_unrealized_pnl
        );
      });
    }

    // --- 10. Actifs génériques (montres, vins, objets de collection, etc.) ---
    if (holding.generic_assets) {
      holding.generic_assets.forEach((ga) => {
        const category = String(ga.category || ga.asset_type || '').toLowerCase();
        const quantity = ga.quantity ?? ga.shares ?? 1;
        const currentPriceRaw =
          ga.display_current_price?.value ??
          ga.display_current_price?.amount ??
          ga.display_current_price ??
          ga.current_price?.amount ??
          ga.current_price?.value ??
          ga.current_price ??
          0;
        const currentPrice =
          typeof currentPriceRaw === 'object'
            ? currentPriceRaw.amount ?? currentPriceRaw.value ?? 0
            : currentPriceRaw;
        const currentValueRaw =
          ga.display_current_value?.amount ??
          ga.display_current_value?.value ??
          ga.display_current_value ??
          ga.current_value ??
          ga.value ??
          ga.estimated_value ??
          (quantity && currentPrice ? quantity * currentPrice : null);
        const currentValue =
          typeof currentValueRaw === 'object'
            ? currentValueRaw.amount ?? currentValueRaw.value ?? null
            : currentValueRaw;
        const name =
          ga.name ||
          ga.label ||
          ga.asset?.name ||
          ga.category ||
          'Actif exotique';

        let assetClass = 'Autres';
        let assetType = 'Autre';
        let assetVehicle = 'Autre';

        if (
          category.includes('watch') ||
          category.includes('montre')
        ) {
          assetType = 'Montre';
          assetVehicle = 'Physique';
        } else if (
          category.includes('wine') ||
          category.includes('vin')
        ) {
          assetType = 'Vin';
          assetVehicle = 'Physique';
        } else if (
          category.includes('jewel') ||
          category.includes('bijou')
        ) {
          assetType = 'Bijoux';
          assetVehicle = 'Physique';
        } else if (
          category.includes('pokemon') ||
          category.includes('carte')
        ) {
          assetType = 'Cartes Pokémon';
          assetVehicle = 'Physique';
        } else if (
          category.includes('sneaker') ||
          category.includes('shoe')
        ) {
          assetType = 'Sneakers';
          assetVehicle = 'Physique';
        } else if (
          category.includes('car') ||
          category.includes('voiture')
        ) {
          assetType = 'Voiture';
          assetVehicle = 'Physique';
        } else if (
          category.includes('artwork') ||
          category.includes('œuvre') ||
          category.includes('oeuvre')
        ) {
          assetType = 'Œuvres d’art';
          assetVehicle = 'Physique';
        } else if (
          category.includes('gem') ||
          category.includes('stone') ||
          category.includes('pierres')
        ) {
          assetType = 'Pierres précieuses';
          assetVehicle = 'Physique';
        } else if (
          category.includes('crowdfunding') ||
          category.includes('real estate') ||
          category.includes('immobilier')
        ) {
          assetType = 'Crowdfunding immobilier';
          assetVehicle = 'Papier';
        } else if (
          category.includes('private debt') ||
          category.includes('private_debt') ||
          category.includes('dette privée')
        ) {
          assetType = 'Dette privée';
          assetVehicle = 'Papier';
        } else if (category.includes('private equity') || category.includes('private_equity')) {
          assetType = 'Private equity';
          assetVehicle = 'Papier';
        } else if (category.includes('hedge fund') || category.includes('hedge_fund')) {
          assetType = 'Hedge fund';
          assetVehicle = 'Papier';
        } else if (category.includes('forest') || category.includes('groupement')) {
          assetType = 'Groupement forestier d’investissement';
          assetVehicle = 'Papier';
        } else if (category.includes('fcpi')) {
          assetType = 'FCPI';
          assetVehicle = 'Papier';
        } else if (category.includes('g3f')) {
          assetType = 'G3F';
          assetVehicle = 'Papier';
        } else if (category.includes('peer') || category.includes('prêt') || category.includes('pret')) {
          assetType = 'Prêts entre particuliers';
          assetVehicle = 'Papier';
        } else if (category.includes('terrain')) {
          assetType = 'Terrain';
          assetVehicle = 'Physique';
        }

        pushAsset(
          ga.id,
          name,
          assetClass,
          assetType,
          assetVehicle,
          currentValue,
          quantity,
          ga.display_unrealized_pnl ??
            ga.unrealized_pnl ??
            ga.pnl ??
            0
        );
      });
    }
  });

  return flattenedAssets;
}

// Si tu utilises des modules ES6 dans ton extension, décommente la ligne suivante :
export { flattenAssets };

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
      assetType,
      category,
      subcategory,
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
        assetType: assetType, // D'où vient la donnée (technique)
        category: category, // Classe d'actif (métier)
        subcategory: subcategory, // Détail
        currentValue: value,
        quantity: quantity,
        pnl_amount: pnl,
      });
    };

    // --- 2. Traitement des CRYPTOS (Logique RealT incluse) ---
    if (holding.cryptos) {
      holding.cryptos.forEach((c) => {
        let category = 'crypto';
        let subcategory = 'coin';
        let name = c.crypto.name || c.crypto.code;

        // Logique RealT
        if (c.crypto.code && c.crypto.code.startsWith('REALTOKEN')) {
          category = 'real_estate';
          subcategory = 'tokenized';
          name = name.replace('REALTOKEN-', '').replace(/-/g, ' ');
        }
        // Logique Stablecoins (Exemple)
        else if (['USDC', 'USDT', 'EURC'].includes(c.crypto.code)) {
          category = 'fiat';
          subcategory = 'stablecoin';
        }

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

    // --- 8. Startups ---
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
  });

  return flattenedAssets;
}

// Si tu utilises des modules ES6 dans ton extension, décommente la ligne suivante :
export { flattenAssets };

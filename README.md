<p align="center">
  <img src="https://github.com/user-attachments/assets/88ebf104-b143-424a-928b-9b213d82cc1b"/>
</p>

# FinaHack

## Introduction

FinaHack est une extension pour l'application (version web) de gestion de patrimoine Finary. Elle permet d'ajouter des fonctionnalités supplémentaires non disponibles dans l'application officielle.

## Motivation

Finary est l'application de gestion de patrimoine par excellence offrant une version mobile et web. Malgré des efforts afin d'être à l'écoute de sa communauté (https://community.finary.com) et la disponibilité historique de leur API (grâce au travail de https://github.com/lasconic/finary_uapi), celle-ci n'est plus vraiment accessible suite à un changement de gestion d'accès/authentification.

Ainsi, plutôt que de demander à l'équipe Finary d'implémenter certaines fonctionnalités, développons les nous-mêmes à travers cette extension sur le même modèle que https://github.com/toolkit-for-ynab/toolkit-for-ynab ;)

## ⚠️ Avertissement

Je ne suis pas développeur professionnel. J'ai juste quelques bases de mes études et j'apprends sur le temps selon mes besoins. Ceci explique la qualité du code qui peut piquer les yeux de certains et le style "bac à sable" de ce repo pour le moment. Si vous voulez aider, n'hésitez pas à participer (remise en qualité du code, nouvelles fonctionnalités, etc.).

## Installation

Pour le moment, l'extension est compatible avec Chrome et Edge.

1. Téléchargez le dossier contenant les sources.
2. Vérifiez que ce dossier contient le fichier manifest.json.
3. Rendez-vous dans le gestionnaire d'extensions (Menu > Outils > Extensions).
4. Passez en 'Mode développeur' en cochant la case correspondante en haut à droite de votre écran.
5. Trois boutons devraient apparaître. Cliquez sur 'Charger l'extension non empaquetée...', puis choisissez le dossier contenant les codes sources et le précieux manifest.json.

## Utilisation
L'extension s'utilise depuis le menu contextuel (clic droit) dans Finary Web :

1. Connectez-vous à votre compte Finary sur https://*.finary.com.
2. Faites un clic droit dans la page.
3. Choisissez l'une des actions suivantes :
   
   * **Manage myAssetType & virtual_envelop (assets)** : ouvre un tableau des assets pour éditer `assetType`, `assetClass`, `assetVehicle` et le champ `virtual_envelop`, puis sauvegarder dans le cache local.
   * **Visualize distribution by myAssetType** : ouvre un graphique de répartition par `assetType`.
   * **Show Top Movers** : ouvre la fenêtre des meilleures/pires performances (assets, enveloppes, classes) sur différentes périodes.

N.B: selon la taille de vos portefeuilles les chargements peuvent être long.

### Dépannage rapide
* Vérifiez que vous êtes bien connecté à Finary dans l'onglet actif (l'extension récupère un token de session).
* Rafraîchissez la page Finary après l'installation ou après une mise à jour de l'extension.
* Si une fenêtre ne s'ouvre pas, regardez la console de l'extension (chrome://extensions Détails "Inspecter les vues") pour voir les erreurs.

## Développement local / Contribution
Les contributions sont les bienvenues ! Issues, PR, Documentation, tout est à prendre :)

1. Clonez le repo sur votre poste
2. Chargez l'extension en local via `chrome://extensions` (Mode développeur Charger l'extension non empaquetée) en pointant vers le dossier du repo.
3. Modifiez les fichiers dans `src/`, puis cliquez sur **Recharger** dans la page des extensions pour prendre en compte les changements.

## 💌 Vous souhaitez me soutenir?

C'est un projet personnel avec lequel je m'amuse pendant mon temps libre. Si vous l'avez trouvé utile et que vous souhaitez soutenir mon travail, vous pouvez:

- transférer tous les token ou coin ERC20 sur Ethereum, Gnosis ou Polygon à l'adresse suivante : 0xEFf0d54e391C6097CdF24A3Fc450988Ebd9a91F7
- utiliser un de mes liens d'affiliation:
  - RealT (Real World Asset Tokenization) https://realt.co/ref/nmathey/
  - MtPelerin (On/Off Ramp crypto aux meilleurs prix) http://mtpelerin.com/fr/join?rfr=P9KPdkL6

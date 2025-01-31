# FinaHack

## Introduction
FinaHack est une extension pour l'application de gestion de patrimoine Finary. Elle permet d'ajouter des fonctionnalités supplémentaires non disponibles dans l'application officielle.

## Motivation
Finary est l'application de gestion de patrimoine par excellence offrant une version mobile et web. Malgré des efforts afin d'être à l'écoute de sa communauté (https://community.finary.com) et la disponibilité historique de leur API (grâce au travail de https://github.com/lasconic/finary_uapi), cette API n'est plus accessible suite à un changement de gestion d'accès/authentification.

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

## Feuille de route / To Do List
- [x] Récupération du token de la session en cours
- [x] POC - Récupérer l'ensemble des holdings
- [x] POC - Afficher une modal box (testé avec une vue consolidée du portefeuille financier + immo hors résidence principale)
- [x] POC - Insertion d'un nouvel asset (testé avec un bien immobilier)
- [ ] POC - Modifier directement l'affichage/ergonomie de l'application  
- [ ] Traduire en JavaScript l'ensemble des fonctions Python de https://github.com/lasconic/finary_uapi
- [ ] Fonctionnalité de synchronisation avec RealT pour les biens immobiliers
- Vos idées via une issue ;)

## Contributions!
Les contributions sont les bienvenues ! Veuillez consulter le fichier CONTRIBUTING.md pour plus de détails.

## 💌 Vous souhaitez me soutenir?
C'est un projet personnel avec lequel je m'amuse pendant mon temps libre. Si vous l'avez trouvé utile et que vous souhaitez soutenir mon travail, vous pouvez transférer tous les token ou coin ERC20 sur Ethereum, Gnosis ou Polygon à l'adresse suivante : 0xEFf0d54e391C6097[...]

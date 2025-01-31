# FinaHack

## Motivation
Finary est l'application de gestion de patrimoine par excellence offrant une version mobile et web. Malgré des efforts afin d'être à l'écoute de sa communauté (https://community.finary.com) et la mise oeuvre d'une roadmap [qui a tendance à déraper :p] (https://finarywealth.notion.site/Finary-Roadmap-publique-d7b515028f254e21bc198a9d9d819821) certains utilisateurs peuvent se retrouver frustrer que certaines fonctionnalités. 
Historiquement leur API était accessible publiquement (grâce aux travail de https://github.com/lasconic/finary_uapi) et permettait à certains de développer autour de celle-ci pour subvenir à ses propres besoins (moi le premier à travers https://github.com/nmathey/finasync). 
Malheureusement cette API n'est plus accessible suite à un changement de gestion d'accès/authentification.

Puis je me suis souvenu qu'ancien utilisateur de l'application de gestion dépenses/budget personnelle YNAB, j'utilisais Toolkit fo YNAB (https://github.com/toolkit-for-ynab/toolkit-for-ynab) une extension d'explorateur web permettant d'interagir directement avec l'application web. 

Ainsi  plutôt que de demander à l'équipe Finary d'implémenter certaines fonctionnalités, faisons-le nous-mêmes à travers une extension!

## ⚠️ Avertissement

Je ne suis pas développeur professionnel. J'ai juste quelques bases de mes études et j'apprends sur le temps selon mes besoins. 
Ceci explique la qualité du code qui peut piquer les yeux de certains: si vous voulez aider n'hésitez pas à participer (remise en qualité du code, nouvelles fonctionnalité etc.)

## Installation 

Pour le moment je reste sur une version chrome/edge.

1. Téléchargez le dossier contenant les sources
2. Vérifiez que ce dossier contient le fichier manifest.json
3. Rendez-vous dans le gestionnaire d'extensions (Menu > Outils > Extensions)
4. Passez en ' Mode développeur ' en cochant la case correspondante en haut à droite de votre écran.
5. Trois boutons devraient apparaître. Cliquez sur ' Charger l'extension non empaquetée... ', puis choisissez le dossier contenant les codes sources et le précieux manifest.json.

## Feuille de route / To Do List
- [x] Récupération du token de la session en cours
- [x] POC - Récupérer l'ensemble des holdings
- [x] POC - Afficher une modal box (testé avec une vue consolidée du portefeuille financier + immo hors résidence principale)
- [x] POC - Insertion d'un nouvel asset (testé avec un bien immobilier)
- [ ] POC - Modifier directement l'affichage/ergonomie de l'application  
- [ ] Traduire en javascript l'ensemble des fonctions python de https://github.com/lasconic/finary_uapi
- [ ] Fonctionnalité de synchronisation avec RealT pour les biens immobiliers
- A vos idées via une issue ;)

## 💌 Vous souhaitez me remercier?

C'est un projet personnel avec lequel je m'amuse pendant mon temps libre. 
Si vous l'avez trouvé utile et que vous souhaitez soutenir mon travail, vous pouvez transférer tous les token ou coin ERC20 sur Ethereum, Gnosis ou Polygon à l'adresse suivante : 0xEFf0d54e391C6097CdF24A3Fc450988Ebd9a91F7 ! 

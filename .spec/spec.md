# Spécifications Fonctionnelles & Architecture JSON — ErgoGalop

## 1. Architecture 100% Data-Driven (Dossier `src/data/`)
Le site web doit obligatoirement être généré dynamiquement à partir des fichiers de configuration suivants :
- `entreprise.json` : Données légales, coordonnées, zone d'intervention (31390 Lafitte-Vigordane).
- `prestations.json` : Catalogue complet des consultations, détails et tarifs.
- `formations.json` : Modules de formations et ateliers pour cavaliers et pros.
- `formulaires.json` : Structure complète du formulaire de pré-diagnostic (champs, types, règles de validation).
- `contenu-site.json` : Textes des sections Hero, À Propos, Réassurance et Engagements.

## 2. Navigation & Styles
- **Header Fixe Noir (`#121212`)** : Logo ErgoGalop (fond noir/texte doré), navigation dynamique.
- **Palette de Couleurs** :
  - Bleu Marine (`#1a365d`) : Titres et sections principales.
  - Bleu Roi (`#2b6cb0`) : Boutons d'action et éléments d'interaction.
  - Fond de Page : Gris très clair (`#f8fafc`).
- **Footer Noir (`#121212`)** : Mentions légales, SIREN, zone géographique (Occitanie/31390).

## 3. Génération des Formulaires et de la Réservation
- La page `reservation.html` génère dynamiquement son formulaire de pré-diagnostic à partir du fichier `formulaires.json`.
- Les données saisies par le client (coordonnées, fiche du cheval, adresse de l'écurie, symptômes) sont structurées pour alimenter automatiquement la base de données client/cheval d'ErgoGalop.
### Page Formations (`formations.html`)
- Présentation du programme de formation (modules cavaliers & professionnels).
- Calendrier des sessions et inscriptions.

### Page À Propos (`a-propos.html`)
- Parcours de Christelle Garcia, certifications, philosophie et approche éthique/scientifique.

### Page Mentions Légales & RGPD (`mentions-legales.html`)
- Informations SASU CG Ergonomie Équine, SIREN, CGV, politique de confidentialité RGPD.
# Constitution du Projet — ErgoGalop (CG Ergonomie Équine)

## 1. Identité 
- **Marque** : ErgoGalop
- **Raison sociale** : SASU CG Ergonomie Équine
- **Fondatrice** : Christelle Garcia
- **Positionnement** : Expertise scientifique et ergonomique équine en Occitanie (départ de Lafitte-Vigordane, 31390).
- **Public cible** : Propriétaires de chevaux, cavaliers professionnels, écuries et centres équestres.

## 2. Vision & Positionnement
- **Positionnement** : Expertise scientifique et ergonomique équine en Occitanie (départ de Lafitte-Vigordane, 31390).
- **Public cible** : Propriétaires de chevaux, cavaliers professionnels, écuries et centres équestres.
- **Les 3 Piliers d'Activité** :
  1. **Prestations** : Consultations à domicile/écurie (saddle fitting, bit fitting, bilan postural).
  2. **Matériel** : Vente d'équipements ergonomiques (selles, embouchures, sangles, tapis adaptés).
  3. **Formations** : Ateliers pour cavaliers, sensibilisation pour écuries et modules pour professionnels.
- **Ton & Image** : Haut de gamme, scientifique, rassurant et pédagogue.

## 3. Charte Graphique & Équilibre Visuel
- **Palette de couleurs** :
  - Identité & Ancrage : Noir profond (`#121212`) — fond du header et du footer pour sublimer le logo doré.
  - Accent / Premium : Doré / Laiton (`#c5a059`) — rappels visuels, boutons d'action principaux, badges.
  - Fond de page principal : Beige sable très clair (`#faf9f6`) — ambiance lumineuse et naturelle.
  - Cartes & Blocs : Blanc pur (`#ffffff`) avec légères ombres.
  - Texte : Anthracite fonce (`#2b2b2b`) pour une lisibilité parfaite.
- **Règles d'intégration du logo** :
  - Le header est sur fond noir, créant un bandeau élégant pour le logo doré.
  - Le reste du corps de page reste clair pour ne pas assombrir l'expérience utilisateur.

## 4. Architecture UX & Parcours Clients (3 Piliers)
- **Prestations (Services)** :
  - Mise en avant des zones d'intervention/tournées.
  - Prise de RDV simplifiée avec pré-questionnaire (localisation, problème identifié).
- **Matériel (Boutique / Catalogue)** :
  - Présentation axée sur les *bénéfices anatomiques* du matériel (pas juste une fiche produit).
  - Boutons d'action : "Commander" ou "Demander conseil pour l'essayage".
- **Formations** :
  - Calendrier des prochains ateliers et sessions.
  - Distinction claire entre formations *Cavaliers* (initiation) et *Pros* (perfectionnement).

## 5. Stack Technique & Standards Code
- **Framework / Langage** : HTML5 sémantique + Tailwind CSS.
- **UX Mobile-First** : Boutons d'action volumineux et facilement cliquables sur smartphone aux écuries.
- **Invariants Métier** : Rappeler que l'ergonomie complète le suivi vétérinaire/ostéopathique sans le remplacer.

## 6. Règles Métier Équines (Invariants)
- **Rassurance** : Rappeler systématiquement que l'ergonomie équine complète le travail du vétérinaire/ostéopathe et ne le remplace pas.
- **Formulaires** : Les demandes de rendez-vous doivent impérativement collecter la localisation du cheval (pour le calcul de la tournée/frais de déplacement).
- **Visuels** : Préférer des visuels d'analyse concrète (posture, ajustement de selle/mors) plutôt que de simples photos banques d'images génériques.

## 7. Architecture de Données (Invariants)
- **Découplage Contenu / Code** : Le code HTML/JS ne doit JAMAIS contenir de tarifs ou de descriptions de prestations en dur.
- **Source de Vérité** : Toutes les informations relatives aux tarifs, prestations, durées et contenus de formation doivent être lues depuis les fichiers de configuration du dossier `src/data/`.
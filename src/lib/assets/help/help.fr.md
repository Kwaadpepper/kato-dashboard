# Guide d'utilisation & Raccourcis KATO

**KATO** est un tableau de bord de supervision haute densité conçu pour les écrans de bureau et les téléviseurs muraux (wallboard), garantissant une visibilité complète en temps réel sans défilement nécessaire.

---

## ⌨️ Raccourcis Clavier

| Raccourci | Action | Description |
| :--- | :--- | :--- |
| `↑` `↓` `←` `→` | Naviguer dans la grille | Se déplacer de cellule en cellule entre les sondes |
| `Début` / `Fin` | Première / Dernière sonde | Sauter instantanément au début ou à la fin de la grille |
| `Entrée` / `Espace` | Ouvrir le détail | Afficher l'historique sur 24h, la disponibilité et les KPI |
| `Échap` | Fermer / Quitter | Fermer la modale active ou quitter le mode plein écran / TV |
| `F` | Plein écran | Basculer en mode plein écran immersif |
| `M` | Alertes sonores | Activer ou couper les tonalités audio d'alerte |
| `T` | Cycle des thèmes | Alterner rapidement entre les thèmes Sombre, Clair et AMOLED |
| `P` | Pause bandeau | Mettre en pause ou relancer le bandeau des incidents |
| `Tab` / `Maj + Tab` | Navigation clavier | Parcourir les éléments interactifs du tableau de bord |
| `?` | Ouvrir l'aide | Afficher cette documentation et les raccourcis |

---

## 🟢 Indicateurs de Statut

- **UP** (Vert) : La sonde répond normalement. Disponibilité optimale.
- **DEGRADED** (Ambre) : Temps de réponse anormalement élevé ou dégradation partielle.
- **DOWN** (Rouge clignotant) : Sonde injoignable ou interruption critique du service.
- **PAUSED** (Gris) : Surveillance temporairement désactivée.
- **MAINTENANCE** (Violet) : Fenêtre d'intervention technique programmée.
- **PENDING** (Bleu) : Initialisation ou premier contrôle en cours d'exécution.

---

## 📺 Mode TV & Supervision Murale

Le mode TV est pensé pour un affichage continu sur écran dédié sans interaction manuelle :

- **Masquage du curseur** : La souris s'efface automatiquement après 5 secondes d'inactivité.
- **Anti Burn-in Drift** : Micro-déplacements réguliers imperceptibles pour prévenir le marquage des dalles OLED et LED.
- **Bandeau d'incidents continu** : Défilement 60 fps des alertes actives ou récentes.
- **Rafraîchissement temps réel** : Connexion Server-Sent Events (SSE) continue avec reconnexion automatique en cas de coupure réseau.

---

## ⚙️ Paramètres Disponibles

Depuis le menu des paramètres (icône engrenage dans la barre supérieure) :

1. **Langue** : Choix entre Français et English avec synchronisation instantanée.
2. **Plein écran** : Activation du mode d'affichage sans barre de navigation de navigateur.
3. **Thèmes visuels** : Sombre (standard), Clair (bureaux lumineux), AMOLED (contraste maximal, noir absolu) ou Automatique selon votre système.
4. **Vitesse du bandeau** : Préréglages Rapide, Normal, Lent ou ajustement fin de la durée (15s à 120s).
5. **Horloge & Fuseau horaire** : Format 24h ou 12h, affichage des secondes et sélection de votre fuseau horaire de référence.

# 🍎 Rafa VIP - Bot & Admin Panel

Système complet de gestion de bot Telegram avec funnel d'onboarding, IA intelligente et panel d'administration.

## 🚀 Fonctionnalités
- **Bot Telegram** : Onboarding réaliste, détection de join requests, funnel de conversion (Apple of Fortune).
- **Vérification Manuelle** : Système de validation des inscriptions (UID) et des dépôts par un admin humain.
- **IA Intelligente** : Un assistant IA (via OpenRouter) disponible pour les membres VIP validés.
- **Panel Admin Web** : Statistiques, gestion des utilisateurs, modification du prompt système, diffusion de messages.

## 🛠️ Installation

### 1. Prérequis
- Node.js (v18+)
- Un token de bot Telegram ([BotFather](https://t.me/botfather))
- Une clé API OpenRouter (pour l'IA)
- Un VPS ou un serveur avec domaine (optionnel pour le développement local)

### 2. Configuration (`.env`)
Créez un fichier `.env` à la racine (ou utilisez les secrets AI Studio) :
```env
TELEGRAM_BOT_TOKEN="votre_token_bot"
ADMIN_ID="votre_id_telegram"
OPENROUTER_API_KEY="votre_cle_openrouter"
ADMIN_PASSWORD="votre_mot_de_pass_panel"
JWT_SECRET="votre_cle_secrete_jwt"
APP_URL="https://votre-domaine.com"
```
*Note : `ADMIN_ID` est nécessaire pour que le bot vous envoie les captures d'écran pour validation.*

### 3. Lancement
```bash
npm install
npm run dev
```

## 📁 Structure du Projet
- `server.ts` : Serveur Express + Bot Telegram (moteur de l'application).
- `bot_database.db` : Base SQLite persistante.
- `uploads/` : Dossier contenant les captures d'écran des utilisateurs (pour protection et historique).
- `src/App.tsx` : Interface React du Panel Admin.

## 🤖 Configuration du Bot (Telegram)
Pour que le bot détecte les demandes d'adhésion :
1. Ajoutez le bot comme **Administrateur** de votre canal.
2. Accordez-lui le droit **Inviter des utilisateurs via des liens**.
3. Activez l'option **Approuver les nouveaux membres** sur votre lien d'invitation.

## 🖥️ Déploiement
Le projet est prêt pour des plateformes comme **Render**, **Railway** ou un **VPS** classique.
1. Configurez les variables d'environnement.
2. Le serveur écoute sur le port `3000`.
3. Assurez-vous que le dossier `uploads/` est persistant (sur VPS) ou utilisez un stockage cloud si nécessaire (bien que SQLite + Local storage soit la base ici).

## 📊 Schéma SQL
La base SQLite est créée automatiquement au lancement. Voici les tables principales :
- `users` : Infos utilisateurs, état du funnel, liens vers les captures.
- `messages` : Historique des conversations pour l'IA.
- `settings` : Configuration globale (ex: Prompt système).

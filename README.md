# ISO BAT — Planning Commercial (application web)

Application de remplacement du fichier Excel : saisie des RDV, consultation
par semaine, statistiques. Construite avec Next.js (hebergee gratuitement sur
Vercel) et Supabase (base de donnees gratuite).

## Vue d'ensemble

- `/login` — mot de passe d'equipe partage (un seul mot de passe pour toute
  l'equipe, simple a mettre en place ; on pourra passer a des comptes
  individuels plus tard si besoin).
- `/dashboard` — statistiques globales (graphiques).
- `/planning` — saisie des RDV, filtrable par mois et semaine.
- `/parametres` — gestion des listes deroulantes (operations, commerciaux...).

Aucune donnee n'est stockee dans le code : tout est dans la base Supabase.

---

## Deploiement (environ 15 minutes, gratuit)

### Etape 1 — Creer la base de donnees (Supabase)

1. Va sur https://supabase.com et cree un compte gratuit (avec Google, ca va vite).
2. Clique **New project**. Choisis un nom (ex. `isobat-planning`), un mot de
   passe pour la base (note-le quelque part), et une region proche
   (`eu-west-1` ou `eu-central-1`).
3. Une fois le projet cree, va dans **SQL Editor** (menu de gauche) -> **New
   query**.
4. Ouvre le fichier `supabase-schema.sql` (fourni dans ce projet), copie tout
   son contenu, colle-le dans l'editeur SQL, puis clique **Run**. Ca cree les
   tables et les listes de depart.
5. Va dans **Project Settings** (icone engrenage) -> **API**. Note deux
   valeurs, elles serviront a l'etape 3 :
   - **Project URL** (ex. `https://xxxxx.supabase.co`)
   - **service_role key** (dans "Project API keys" — PAS la cle "anon
     public", bien la cle "service_role")

### Etape 2 — Mettre le code sur GitHub

1. Cree un compte gratuit sur https://github.com si tu n'en as pas.
2. Cree un nouveau depot (bouton vert **New**), nom libre (ex.
   `isobat-planning`), le laisser "Private" est recommande.
3. Televerse tous les fichiers de ce projet dans ce depot (glisser-deposer
   le dossier dans l'interface web GitHub, ou "Add file" -> "Upload files").

### Etape 3 — Deployer sur Vercel

1. Va sur https://vercel.com et cree un compte gratuit **en te connectant
   avec ton compte GitHub** (bouton "Continue with GitHub") — ca simplifie
   tout le reste.
2. Clique **Add New** -> **Project**, puis choisis le depot GitHub que tu
   viens de creer.
3. Avant de cliquer "Deploy", ouvre la section **Environment Variables** et
   ajoute ces 4 variables (copie-colle les noms exactement) :

   | Nom | Valeur |
   |---|---|
   | `SUPABASE_URL` | le "Project URL" note a l'etape 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | le "service_role key" note a l'etape 1 |
   | `TEAM_PASSWORD` | un mot de passe que tu choisis pour l'equipe |
   | `SESSION_SECRET` | n'importe quelle longue chaine aleatoire (ex. tape au hasard sur ton clavier, 30+ caracteres) |

4. Clique **Deploy**. Apres 1-2 minutes, Vercel te donne une adresse du type
   `https://isobat-planning.vercel.app` — c'est ton application, en ligne,
   gratuitement, avec HTTPS automatique.

### Etape 4 — Se connecter

Ouvre l'adresse Vercel, entre le mot de passe que tu as choisi
(`TEAM_PASSWORD`), et voila.

---

## Mettre a jour l'application plus tard

Si tu (ou moi) modifions le code : il suffit de remplacer les fichiers dans
le depot GitHub, Vercel redeploie automatiquement en 1-2 minutes, sans rien
faire de plus.

## Securite — ce qui est deja fait / ce qui reste a ton choix

**Deja gere automatiquement :**
- HTTPS (chiffrement) sur le trafic entre les utilisateurs et l'appli.
- La cle secrete Supabase (`service_role`) ne quitte jamais le serveur — le
  navigateur ne la voit jamais, elle n'est pas dans le code visible.
- La base de donnees a la "Row Level Security" activee : elle refuse tout
  acces direct, seule l'appli (via la cle secrete) peut lire/ecrire.

**A ton choix, selon vos besoins :**
- Aujourd'hui, tout le monde utilise le meme mot de passe d'equipe. Si tu
  veux un compte + mot de passe par personne (pour savoir qui a modifie
  quoi), c'est possible avec Supabase Auth — dis-le moi, je l'ajoute.
- Il n'y a pas de sauvegarde automatique visible : Supabase fait des
  sauvegardes techniques, mais si tu veux exporter les donnees regulierement
  (ex. vers Excel), on peut ajouter un bouton "Exporter" facilement.

## Developpement local (optionnel)

```bash
npm install
cp .env.example .env.local   # puis remplis les 4 valeurs
npm run dev
```

Ouvre http://localhost:3000

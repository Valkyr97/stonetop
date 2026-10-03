# Deploy

SPA Vite estática. Build: `npm run build` (el `prebuild` copia packs a `public/content/`). Salida: `dist`.

Las mismas tres claves que en `.env.local` (archivo local, **no** se sube a Git ni a Vercel):

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_SUPABASE_PROJECT_REF
```

Cópialas en Vercel → Project Settings → Environment Variables (Production y Preview). El build en la nube no lee `.env.local`.

Confirma que el project ref es **mwhfcrscbpvxlaezthab**. Nunca uses keys de otro proyecto.

En Supabase Auth → URL configuration:

- Site URL: `https://<tu-dominio>`
- Redirect URLs: `https://<tu-dominio>/**`

Los packs van en `dist/content/`. El bucket Storage `content-packs` queda como canal opcional.

## Vercel

El repo de la app es `MyVersion/` (`vercel.json` + Node 20 en `.nvmrc`).

1. [vercel.com/new](https://vercel.com/new) → Import Git Repository.
2. **Root Directory:** `MyVersion` si el Git root es el monorepo `stonetop`. Si el remote es solo `MyVersion`, déjalo vacío.
3. Framework Preset: Vite (o lo detecta `vercel.json`).
4. Añade las tres `VITE_*` en Project Settings → Environment Variables.
5. Deploy.

CLI (desde `MyVersion/`, con `npx vercel` logueado):

```bash
npx vercel          # preview
npx vercel --prod   # producción
```

Vercel sirve archivos que existen (`/content/*.json`, assets) y el rewrite envía el resto a `index.html`. El router es hash (`#/…`), así que las rutas de la app no dependen de ese rewrite; sí cubre el PWA `start_url: /`.

## Cloudflare Pages

Direct upload (sin GitHub), desde `MyVersion/` después de `npm run build` (Vite lee `.env.local` y las mete en el JS):

1. Crea un token: [Create API token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)  
   Plantilla **Edit Cloudflare Workers** (incluye Pages) o un token custom con permiso **Account → Cloudflare Pages → Edit**.
2. En PowerShell (esta sesión):

```powershell
$env:CLOUDFLARE_API_TOKEN = "pega-el-token"
npx wrangler@3 pages deploy dist --project-name=stonetop
```

Node 20: usa Wrangler 3 (`npx wrangler@3 …`). Wrangler 4 pide Node 22.

O en el dashboard: Workers & Pages → Create → Direct Upload de la carpeta `dist`.

Si más adelante conectas GitHub:

1. Build command: `npm run build`
2. Output directory: `dist`
3. Las mismas `VITE_*` en Settings → Environment variables (Production)
4. Root directory `MyVersion` si el Git root es el monorepo

Luego en Supabase Auth, Site URL = `https://stonetop.pages.dev` (o el dominio que asigne Cloudflare).

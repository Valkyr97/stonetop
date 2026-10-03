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

1. Build command: `npm run build`
2. Output directory: `dist`
3. Las mismas variables `VITE_*`
4. Root directory `MyVersion` si el Git root es el monorepo

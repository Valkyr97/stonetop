# Stonetop (offline-first)

SPA Svelte + Vite + PWA + Supabase para hojas de personaje y entrega de contenido (grants).

## Aislamiento Supabase

Este repo usa **solo** el proyecto:

| Campo | Valor |
|---|---|
| Nombre | `stonetop` |
| Ref | `mwhfcrscbpvxlaezthab` |
| Región | `eu-west-1` |
| Org | `Valkyr97's Org` (personal, free) |

**No** apunta al proyecto de trabajo ni a ningún otro. Las migraciones se aplicaron únicamente a `mwhfcrscbpvxlaezthab`.

## Setup local

```bash
cp .env.example .env.local
# .env.local ya debería apuntar al proyecto stonetop
npm install
npm run dev
```

Abre `http://localhost:5173`.

- **Jugadores**: sin cuenta. En Inicio, "Crear personaje" → elige playbook → juega offline. Cuando quieran unirse a tu mesa, introducen el código de campaña desde la ficha ("Unir a mesa").
- **GM**: entra en "Acceso GM" (arriba a la derecha) para crear campaña, obtener el código y ver/gestionar los personajes que se han unido.

## Arquitectura breve

- **Packs** en `content/` → se copian a `public/content/` (first load local / PWA cache)
- **IndexedDB** guarda el roster local de personajes (con o sin mesa), grants y arcana state
- **Claim**: unir un personaje local a una campaña genera un `claim_secret` (solo en ese dispositivo) que autoriza el push/pull de esa ficha sin necesidad de cuenta
- **Sincronizar** hace pull/push manual (sin Realtime)
- GM libera arcana con `front_only` o `full`

## Scripts

- `npm run content:copy` — copia packs a `public/content`
- `npm run build` — build estático (Vercel / Cloudflare Pages / cualquier host estático)
- `npm run check` — typecheck

## Docs

- [docs/BANDWIDTH.md](docs/BANDWIDTH.md) — checklist de red
- [docs/DEPLOY.md](docs/DEPLOY.md) — Vercel / Cloudflare Pages
- [docs/SUPABASE_ISOLATION.md](docs/SUPABASE_ISOLATION.md) — proyecto Supabase exclusivo
- [docs/CONTENT_ATTRIBUTION.md](docs/CONTENT_ATTRIBUTION.md) — texto de reglas CC BY-SA 4.0

## Contenido de reglas

El pack de creación y de arcana incluyen `rule_text` ingerido desde el corpus público CC BY-SA (wiki Stonetop). Regenerar:

```bash
npm run content:ingest-rules
npm run content:copy
```

# Bandwidth checklist

Objetivo: descarga grande al principio, luego poco/nulo tráfico.

## First load (con red)

| Recurso | Origen | Notas |
|---|---|---|
| App shell (JS/CSS/HTML) | Host estático | Cacheado por Service Worker |
| `/content/manifest.json` | Host estático | ~1 KB |
| `/content/packs/creation-v0.1.json` | Host estático | Pack base obligatorio |
| `/content/packs/arcana-v0.1.json` | Host estático | Opcional pero incluido en sync |

Medir tras `npm run build`:

```bash
npm run build
# revisar dist/assets y dist/content
```

## Sync manual (botón Sincronizar)

| Operación | Tamaño típico |
|---|---|
| Auth session refresh | pequeño |
| Pull `characters` row | ~5–30 KB JSON |
| Pull `content_grants` | ~1–5 KB |
| Pull `arcana_state` | ~1–10 KB |
| Push character state (solo si dirty) | ~5–30 KB |
| Packs | **0** si hash local coincide |

## Offline

Tras primera sincronización / carga de packs:

- Editar hoja: **0 red**
- Marcar arcana: **0 red**
- Sync falla con mensaje claro si `navigator.onLine === false`

## Versionado de packs

`content/manifest.json` incluye `sha256` por pack.

- Si el hash no cambia → no se re-descarga
- Si cambia solo `arcana-v0.2.json` → solo ese archivo

## Qué no hacer en baja red

- No activar Supabase Realtime
- No fetch de wiki en runtime para cada move
- No meter imágenes de arte oficiales en el bundle

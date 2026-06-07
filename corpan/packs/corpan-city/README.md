# Corpan City

A data-driven, 2.5D paper-cutout language-learning RPG, shipped as a Corpán
pack with its own server.

> **The spine:** the *shared space is abstract; what each player sees and
> pursues is data.* A **Room** is the authoritative collision / position /
> socket space everyone in it shares. A **Scene** is a per-player, data-driven
> *skin* of that room (a place + era + art style). A **Quest** is a per-player,
> *orthogonal* goal that reprograms how the AI NPCs (on-device Qwen3) teach.
> Two people stand in the same Room and collide in the same geometry — but one
> walks **Antigua 1770** building café Spanish toward Guadalajara while the other
> walks **Tokyo 2050** building business French toward Paris. Skinning is
> per-player; the socket space is shared.

The full architecture lives in the approved plan (see the project plan doc).
This README tracks the buildable structure.

## Layout

```
corpan-city/
├── contracts/        # @corpan-city/contracts — Zod schemas + types (the spine)
│   └── src/
├── src/              # Babylon client (pack UI, IIFE bundle)
├── server/           # co-located TS backend (Colyseus realtime + Fastify API)
├── content/          # data-driven scenes / quests / paths / topologies
├── art/              # 2D sprite + 3D town asset pipelines
├── manifest.json     # Corpán pack manifest
└── vite.config.ts    # IIFE build → dist/app.js
```

## Contracts

`@corpan-city/contracts` is the single source of truth for every boundary
(client ↔ Colyseus ↔ API). It exports both **Zod schemas** (runtime validation
at boundaries) and **inferred TypeScript types** (compile-time). Import via the
path alias:

```ts
import { RoomTopology, Scene, Quest, parseScene } from "@corpan-city/contracts"
```

## Scripts

- `npm run typecheck` — `tsc --noEmit`
- `npm run test:run` — vitest (contract conformance)
- `npm run build` — production IIFE bundle → `dist/`
- `npm run dev` — vite dev server

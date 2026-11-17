import { z } from "zod";

// Zod would otherwise probe `new Function` once, which the site's Content
// Security Policy reports as a violation. Each entry imports it first
// (home-entry.tsx, app/boot.tsx): the bundle runs a shared chunk's modules in
// the order its entries import them, so a later import let schemas built
// before it probe (production, 2026-11-17).
z.config({ jitless: true });

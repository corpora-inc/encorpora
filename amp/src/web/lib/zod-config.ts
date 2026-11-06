import { z } from "zod";

// Zod would otherwise probe `new Function` once, which the site's Content
// Security Policy reports as a violation. Imported first by `main.tsx`.
z.config({ jitless: true });

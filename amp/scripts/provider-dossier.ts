import { createHash } from "node:crypto";
import { firstWaveDossiers } from "../src/funding/first-wave-dossiers.js";
import { auditDossiers } from "../src/funding/dossier.js";
import { fundingRegistry } from "../src/funding/registry.js";
import { books } from "../src/books/catalog.js";
import { templates } from "../src/math/engine.js";
const args = process.argv.slice(2);
if (args.length > 1)
  throw new Error("Usage: tsx scripts/provider-dossier.ts [YYYY-MM-DD]");
const asOf = args[0] ?? new Date().toISOString().slice(0, 10);
const errors = auditDossiers(
  firstWaveDossiers,
  asOf,
  fundingRegistry.programs.map((p) => p.id),
);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    JSON.stringify(
      {
        kind: "unsubmitted-provider-evidence-draft",
        asOf,
        limitations: [
          "Generated catalog inventory, not complete K–12 coverage, production availability, independently reviewed certification or agency approval.",
          "PDF availability requires separately verified deployed publication manifests.",
          "No private tax, banking, student or approval records included.",
        ],
        templates: templates.map((t) => ({
          id: t.id,
          version: t.version,
          skillId: t.skillId,
        })),
        books: books.map((b) => ({
          id: b.content.id,
          title: b.content.title,
          version: b.content.version,
          pages: b.content.pages.length,
          contentSha256: createHash("sha256")
            .update(JSON.stringify(b.content))
            .digest("hex"),
          templateIds: b.bindings.map((x) => x.templateId),
        })),
        programs: firstWaveDossiers.dossiers,
        sources: firstWaveDossiers.sources,
      },
      null,
      2,
    ),
  );

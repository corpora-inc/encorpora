/**
 * Compatibility re-export. **Temporary, and scheduled for deletion.**
 *
 * The library moved to `dynawalla/packs/shared/curriculum/` so that packs — which
 * are the product — can import it without reaching into the host app's tree. One
 * consumer still resolves it at the old path: `dynawalla-app/src/work/curriculum.ts`
 * imports `../../../curriculum/src/index.ts`, and that file belongs to the app
 * track, not to this one. Rewriting it from here would be an out-of-scope edit to a
 * tree another track is actively changing.
 *
 * So this file exists to keep that import resolving, and nothing else. It adds no
 * surface: every name below comes from the library's own `index.ts`, which is the
 * one public API. When the app's seam is repointed at
 * `packs/shared/curriculum/src/index.ts` (or the work surface moves into a pack, as
 * the architecture ruling intends), delete this file and the directory it sits in.
 */

export * from "../../packs/shared/curriculum/src/index.ts";

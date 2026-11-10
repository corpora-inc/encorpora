import { Link } from "@tanstack/react-router";
import type { SignedInMe } from "../../../account/contracts";
import { buttonClass } from "../../ui/Button";

/** Account → Family, Billing and consent for a second parent with no family
 * of her own (docs/families.md): what's hers, what's the account holder's,
 * and the way to her family's class. */
export function SecondParentNote({ me }: { me: SignedInMe }) {
  const family = me.secondParentOf?.[0];
  if (!family) return null;
  return (
    <section className="family-section" data-second-parent-note>
      <h2 tabIndex={-1}>{family.className}</h2>
      <p>
        You’re a parent in {family.className}. You see the class and the
        children’s progress, can let a child practice on your device, and
        practice free yourself. The parent who invited you manages billing,
        consent and the children’s names.
      </p>
      <Link
        to="/$"
        params={{
          _splat: `school/${family.orgId}/classes/${family.classId}/today`,
        }}
        className={buttonClass("primary")}
      >
        Open {family.className}
      </Link>
    </section>
  );
}

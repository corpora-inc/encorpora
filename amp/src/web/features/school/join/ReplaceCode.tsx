import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { formatJoinCode } from "../../../../schools/contracts";
import { sessionOptions } from "../../../lib/query";
import { Button } from "../../../ui/Button";
import { Dialog } from "../../../ui/Dialog";
import { Toast } from "../../../ui/Toast";
import { useRotateCode } from "../classes/api";
import type { SpaceWords } from "../../spaces/words";

/**
 * Replace code: a setting, never beside the way in (family Settings, a
 * class's Settings). The old code, its link and its QR stop working, so it
 * asks first. While sign-in is paused by guessing it is the way on, so it
 * is the primary action then.
 */
export function ReplaceCode({
  place,
  words,
  locked = false,
}: {
  place: { org: string; class: string };
  /** Whose code, in the space's words: "family code", "class code". */
  words: Pick<SpaceWords, "code">;
  locked?: boolean;
}) {
  const session = useQuery(sessionOptions).data ?? null;
  const rotate = useRotateCode(session, place);
  const [asking, setAsking] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const name = words.code;
  async function replace() {
    try {
      const { joinCode } = await rotate.mutateAsync();
      setAsking(false);
      setStatus(`The new ${name} is ${formatJoinCode(joinCode)}.`);
    } catch (failure) {
      console.error("A new code could not be made", failure);
      setAsking(false);
      setError(
        "The code wasn’t replaced, so the old one still works. Try again in a moment.",
      );
    }
  }
  return (
    <>
      <Button
        variant={locked ? "primary" : "secondary"}
        data-replace-code=""
        onClick={() => setAsking(true)}
      >
        Replace code
      </Button>
      <Dialog
        open={asking}
        onOpenChange={(open) => {
          if (!rotate.isPending) setAsking(open);
        }}
        title={`Replace the ${name}?`}
      >
        <p style={{ margin: 0 }}>
          The old code, its link and its QR stop working. Anyone signed in stays
          signed in.
        </p>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--space-2)",
            marginTop: "var(--space-4)",
          }}
        >
          <Button
            variant="primary"
            aria-busy={rotate.isPending || undefined}
            disabled={rotate.isPending}
            onClick={() => void replace()}
          >
            Replace code
          </Button>
          <Button
            variant="quiet"
            disabled={rotate.isPending}
            onClick={() => setAsking(false)}
          >
            Keep this code
          </Button>
        </div>
      </Dialog>
      <Toast message={status} tone="status" onDismiss={() => setStatus("")} />
      <Toast message={error} onDismiss={() => setError("")} />
    </>
  );
}

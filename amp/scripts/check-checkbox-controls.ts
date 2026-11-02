import { fileURLToPath } from "node:url";
import { checkboxPolicyViolations } from "./checkbox-policy";
const violations = checkboxPolicyViolations(
  fileURLToPath(new URL("../src/web", import.meta.url)),
);
if (violations.length) {
  console.error(
    "Use ui/Checkbox instead of an ad hoc checkbox:\n" + violations.join("\n"),
  );
  process.exitCode = 1;
} else console.log("Shared checkbox ownership verified.");

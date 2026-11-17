import { fileURLToPath } from "node:url";
import { checkboxPolicyViolations } from "./checkbox-policy";
import { formPolicyViolations } from "./form-policy";

/** `npm run lint:controls`: the shared controls own their native elements. */
const web = fileURLToPath(new URL("../src/web", import.meta.url));
const checkboxes = checkboxPolicyViolations(web);
const forms = formPolicyViolations(web);
if (checkboxes.length)
  console.error(
    "Use ui/Checkbox instead of an ad hoc checkbox:\n" + checkboxes.join("\n"),
  );
if (forms.length)
  console.error(
    "Use ui/Form and ui/TextField, never the browser's validation bubble:\n" +
      forms.join("\n"),
  );
if (checkboxes.length || forms.length) process.exitCode = 1;
else console.log("Shared checkbox and form ownership verified.");

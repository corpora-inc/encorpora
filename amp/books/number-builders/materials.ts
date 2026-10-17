import { Author, text, note } from "./authoring.js";
import { frame, tens } from "./models.js";
export function addMaterials(a: Author) {
  a.section = "entry";
  a.page(
    "reusable-ten-mat",
    "A mat to use again",
    [
      text(
        "Place one counter in each space. Move counters. Clear the mat. Build a new number.",
      ),
      frame(
        "reusable-empty-frames",
        0,
        "Each frame has 10 places: 2 rows of 5.",
        { frames: 2 },
      ),
      note(
        "For a counting partner",
        "Use safe household counters or draw small marks. The size of a counter does not change the count. This mat can be copied and reused; learners do not need to cut anything.",
        "connect",
      ),
    ],
    "workshop",
  );
  a.page(
    "unit-tools",
    "Tens and ones to trade",
    [
      text(
        "For an adult: cut around each long strip, keeping its ten squares joined. Cut out the loose squares one by one.",
      ),
      tens(
        "reusable-unit-pieces",
        2,
        10,
        "Every small square has the same printed size. Each long strip contains 10 of those squares.",
      ),
      note(
        "Keep the unit the same",
        "Print this page at its original size. Do not enlarge only the strips or only the loose squares. Ten loose squares can cover the ten cells in one strip.",
      ),
      note(
        "No cutting needed",
        "You can instead trace the pieces, use matching household blocks or draw tens and ones. Explain the units before trading.",
        "connect",
      ),
    ],
    "guide",
  );
}

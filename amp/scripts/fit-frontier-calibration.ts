import { templates } from "../src/math/engine";
import { skills } from "../src/curriculum/catalog";
import {
  templateCalibration,
  templateGrade,
} from "../src/learning/item-calibration";
import { fitSyntheticItem } from "./frontier/calibration-fit";
import { developmentPopulations } from "./frontier/synthetic-learner";
const nodes = new Map(skills.map((skill) => [skill.id, skill]));
const fits = templates.map((template, index) =>
  fitSyntheticItem(
    template,
    templateGrade(template, nodes),
    templateCalibration(template, nodes),
    developmentPopulations[0]!,
    9001 + index,
  ),
);
console.log(
  JSON.stringify(
    {
      disclaimer:
        "Diagnostic synthetic fits only. Do not use these as learner-calibrated production parameters.",
      fits,
    },
    null,
    2,
  ),
);

import { Link } from "@tanstack/react-router";
import { useLearningView } from "../../lib/learning-view";
import { buttonClass } from "../../ui/Button";
import { parentHome } from "./parent-home";

export function FamilyReturn() {
  const { account } = useLearningView({ records: false });
  const home = parentHome(account);
  return home ? (
    <Link
      to="/$"
      params={{ _splat: home.slice(1) }}
      className={buttonClass("quiet")}
    >
      Open your family
    </Link>
  ) : null;
}

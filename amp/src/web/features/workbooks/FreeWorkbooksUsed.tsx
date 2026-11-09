import { Link } from "@tanstack/react-router";
import { buttonClass, type ButtonVariant } from "../../ui/Button";
import styles from "./Workbooks.module.css";

/** What follows the line: a family parent continues with AMP, a class or
 * school talks to us, and an adult or a child has no purchase to offer. */
export type FreeWorkbooksNext = "purchase" | "talk" | null;

/** Where a new workbook can't be made because the five free ones are used:
 * one calm line, then the step that succeeds. Never an error. */
export function FreeWorkbooksUsed({
  next,
  variant = "primary",
  className = "",
}: {
  next: FreeWorkbooksNext;
  variant?: ButtonVariant;
  className?: string;
}) {
  return (
    <div className={`${styles.used} ${className}`} data-free-workbooks-used>
      <p>
        The five free workbooks are used. Past workbooks and their results stay
        here.
      </p>
      {next === "purchase" ? (
        <Link
          to="/$"
          params={{ _splat: "purchase/choose" }}
          className={buttonClass(variant)}
        >
          Continue with AMP
        </Link>
      ) : next === "talk" ? (
        <Link to="/schools" hash="talk" className={buttonClass(variant)}>
          Talk to us
        </Link>
      ) : null}
    </div>
  );
}

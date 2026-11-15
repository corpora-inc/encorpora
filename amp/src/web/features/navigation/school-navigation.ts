import { useSpace } from "../spaces/useSpace";
import type { ShellFrame } from "./shell-frame";

/**
 * A class or school screen's view of its own space (features/spaces): its
 * tabs, whether practice can be started for its class, and whether it is a
 * demo place. The same resolution the shell's bar draws, so a screen and the
 * bar never disagree.
 */
export function useSchoolNavigation(
  frame: Extract<ShellFrame, { kind: "class" | "school" }>,
) {
  const space = useSpace({
    pathname:
      frame.kind === "class"
        ? `/school/${frame.org}/classes/${frame.classId}/${frame.leaf}`
        : `/school/${frame.org}`,
  });
  const org =
    space?.space === "classroom" || space?.space === "school"
      ? space.org
      : null;
  return {
    tabs: space?.tabs ?? [],
    start: space?.space === "classroom" && space.class.start ? true : false,
    demo: space?.space === "family" ? space.family.demo : org?.demo === true,
    solo: org?.lone === true,
  };
}

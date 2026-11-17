import { Link } from "@tanstack/react-router";
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import { useOpenView, type View } from "./view-store";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  /** The screen's path, with or without its leading slash. */
  to: string;
  /** What the screen opens with chosen (view-store.ts): its view, set in
   * the click before navigating, never carried by the address. */
  view: View;
  replace?: boolean;
  children?: ReactNode;
};

/** A link to a school screen that opens with something chosen there: one
 * term's grades, the add sheet open, one year's classes. */
export function ViewLink({ to, view, onClick, replace, ...rest }: Props) {
  const open = useOpenView();
  return (
    <Link
      {...rest}
      to="/$"
      params={{ _splat: to.replace(/^\/+/, "") }}
      replace={replace}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event);
        if (!event.defaultPrevented) open(to, view);
      }}
    />
  );
}

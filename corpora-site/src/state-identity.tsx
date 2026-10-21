import React from "./react.js";
import { arkansasOutline } from "./arkansas-outline.js";

export const stateNames: Record<string, string> = Object.fromEntries(
  "US:Nationwide|AL:Alabama|AK:Alaska|AZ:Arizona|AR:Arkansas|CA:California|CO:Colorado|CT:Connecticut|DE:Delaware|DC:District of Columbia|FL:Florida|GA:Georgia|HI:Hawaii|ID:Idaho|IL:Illinois|IN:Indiana|IA:Iowa|KS:Kansas|KY:Kentucky|LA:Louisiana|ME:Maine|MD:Maryland|MA:Massachusetts|MI:Michigan|MN:Minnesota|MS:Mississippi|MO:Missouri|MT:Montana|NE:Nebraska|NV:Nevada|NH:New Hampshire|NJ:New Jersey|NM:New Mexico|NY:New York|NC:North Carolina|ND:North Dakota|OH:Ohio|OK:Oklahoma|OR:Oregon|PA:Pennsylvania|RI:Rhode Island|SC:South Carolina|SD:South Dakota|TN:Tennessee|TX:Texas|UT:Utah|VT:Vermont|VA:Virginia|WA:Washington|WV:West Virginia|WI:Wisconsin|WY:Wyoming"
    .split("|")
    .map((entry) => entry.split(":")),
);

/** Original geographic typography, not a government seal or approval badge. */
export function StateIdentity({
  state,
  compact = false,
}: {
  state: string;
  compact?: boolean;
}) {
  return (
    <span
      className={`state-identity${compact ? " state-identity-compact" : ""}`}
      aria-hidden="true"
    >
      <span className="state-identity-grid" />
      {state === "AR" && !compact && (
        <svg
          className="state-outline"
          viewBox={arkansasOutline.viewBox}
          focusable="false"
        >
          <path d={arkansasOutline.path} />
        </svg>
      )}
      <span
        className={`state-identity-code${state === "AR" && !compact ? " state-code-small" : ""}`}
      >
        {state}
      </span>
      {!compact && (
        <span className="state-identity-name">
          {stateNames[state] ?? state}
        </span>
      )}
    </span>
  );
}

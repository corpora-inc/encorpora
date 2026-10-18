import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { AnnualOffer } from "../billing/stripe/purchase-contracts";
import type { PublicFundingOffer } from "../funding-purchase/contracts.js";
import { stateNames } from "./us-states";

type Props = {
  token: string;
  learnerName: string | null;
  onCard: () => void;
  onFunds: (offerId: string) => void;
  onClose: () => void;
};

const usd = (minor: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    minor / 100,
  );

/** The paywall: one year of AMP, paid by card or with a state's education
 * funds. Prices come from the server's configured offers. */
export function ChooseHowToPay(props: Props) {
  const [card, setCard] = useState<AnnualOffer | null>();
  const [funds, setFunds] = useState<PublicFundingOffer[]>();
  const [state, setState] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => heading.current?.focus({ preventScroll: true }), []);
  useEffect(() => {
    const headers = { authorization: `Bearer ${props.token}` };
    const load = async <T,>(path: string) => {
      const response = await fetch(`/api/v1${path}`, { headers });
      if (!response.ok) throw new Error(`${path}: ${response.status}`);
      return (await response.json()) as T;
    };
    let alive = true;
    void load<{ available: boolean; offer?: AnnualOffer }>("/billing/offer")
      .then((data) => alive && setCard(data.available ? data.offer : null))
      .catch((error) => {
        console.warn("Card offer unavailable", error);
        if (alive) setCard(null);
      });
    void load<{ offers: PublicFundingOffer[] }>("/funding/offers")
      .then((data) => alive && setFunds(data.offers))
      .catch((error) => {
        console.warn("Education-fund offers unavailable", error);
        if (alive) setFunds([]);
      });
    return () => {
      alive = false;
    };
  }, [props.token]);

  const states = [...new Set(funds?.map((o) => o.jurisdiction) ?? [])].sort(
    (a, b) => (stateNames[a] ?? a).localeCompare(stateNames[b] ?? b),
  );
  const programs = funds?.filter((o) => o.jurisdiction === state) ?? [];
  return (
    <section className="choose-pay" aria-labelledby="choose-pay-title">
      <header className="choose-pay-header">
        <button type="button" className="secondary" onClick={props.onClose}>
          Back to family
        </button>
      </header>
      <div className="choose-pay-body">
        <div className="choose-pay-intro">
          <h1 id="choose-pay-title" tabIndex={-1} ref={heading}>
            One year of AMP
          </h1>
          {props.learnerName && <p className="pay-for">{props.learnerName}</p>}
          <p>
            Adaptive practice from counting to SAT, a short lesson for every
            type of problem, and printable worksheets with full solutions.
          </p>
        </div>
        <section className="pay-option" aria-labelledby="pay-card">
          <h2 id="pay-card">Card</h2>
          {card === undefined ? (
            <p aria-busy="true" className="pay-muted">
              Loading…
            </p>
          ) : card ? (
            <>
              <p className="pay-price">
                {card.formattedAmount} <span>for 12 months</span>
              </p>
              <button className="go-button" onClick={props.onCard}>
                Pay by card
              </button>
            </>
          ) : (
            <p className="pay-muted">Card payment is not available.</p>
          )}
        </section>
        <section className="pay-option" aria-labelledby="pay-funds">
          <h2 id="pay-funds">ESA or education funds</h2>
          {funds === undefined ? (
            <p aria-busy="true" className="pay-muted">
              Loading…
            </p>
          ) : states.length ? (
            <>
              <label>
                State
                <select
                  value={state}
                  onChange={(event) => setState(event.target.value)}
                >
                  <option value="">Choose your state</option>
                  {states.map((code) => (
                    <option key={code} value={code}>
                      {stateNames[code] ?? code}
                    </option>
                  ))}
                </select>
              </label>
              {programs.map((offer) => (
                <button
                  key={offer.id}
                  className="pay-program"
                  data-offer={offer.id}
                  onClick={() => props.onFunds(offer.id)}
                >
                  {offer.programName}
                  <span>{usd(offer.totalMinor)} for 12 months</span>
                </button>
              ))}
            </>
          ) : (
            <p className="pay-muted">No education-fund program is available.</p>
          )}
        </section>
      </div>
    </section>
  );
}

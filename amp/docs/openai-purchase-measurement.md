# OpenAI purchase measurement

AMP retains an OpenAI ad's original `oppref` at its public application entrance. An HTTPS, HttpOnly acquisition cookie connects that visit to the parent's exact invoice or Stripe checkout. The raw reference stays in the database and is removed from the address bar. Learning routes do not collect it.

The purchase worker sends `order_created` only after the backend verifies an initial live Stripe payment or a settled Arkansas EFA or Arizona ESA order. It requires current, separate OpenAI purchase-sharing permission from a confirmed adult account, granted before purchase. Google or Meta permission does not authorize OpenAI sharing. Privacy signals and withdrawal stop delivery.

Events contain the original click reference, an opaque event ID, purchase time, amount and currency. They contain no email, learner information or learning activity. Stripe purchases use the web action source; asynchronous DirectPay settlements use `other`. The integration sets `opt_out: true` to request no future user-level personalization.

Run `npm run advertising:openai -- collect`, then `deliver`. `report` returns safe counts. Configure `AMP_OPENAI_MEASUREMENT_CONFIG` as an owner-readable JSON file containing `enabled`, `pixelId`, and the existing verified-payment `sources` mapping. `AMP_OPENAI_MEASUREMENT_KEY` names an owner-readable file holding the Conversions API key. Account-specific setup belongs in the private infrastructure repository; credentials belong in the platform secret store.

The API accepts events within seven days of purchase. This integration requires a click observed within thirty days before purchase. Retries preserve the same pixel, event type, ID and payload; uncertain network responses wait five minutes before retrying. Changed payment evidence, a refund, expired permission or withdrawal prevents resubmission. Accepted receipts do not prove attribution or current net revenue. Refund corrections after an accepted event are not exported. Local delivery records expire after ninety days.

Protocol: [OpenAI Conversions API](https://developers.openai.com/ads/conversions-api). Use `validate_only: true` for integration acceptance; never send synthetic purchases as live conversions.

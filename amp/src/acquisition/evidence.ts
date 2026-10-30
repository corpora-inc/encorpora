/** Internal SQL expressions only. Never pass request input as an expression. */
export function purchaseEvidenceSql(account: string) {
  return `(EXISTS(SELECT 1 FROM amp_payment_records r WHERE r.account_id=${account} AND r.status='verified')
    OR EXISTS(SELECT 1 FROM amp_commerce_orders o WHERE o.account_id=${account} AND o.channel<>'pilot' AND o.order_state->>'settlement'='settled')
    OR EXISTS(SELECT 1 FROM amp_funding_invoice_intents i WHERE i.received_payment_at IS NOT NULL AND
      (i.claimed_account_id=${account} OR (i.claimed_account_id IS NULL AND EXISTS(
        SELECT 1 FROM amp_auth_users buyer WHERE 'amp|'||buyer.id=${account} AND buyer."emailVerified" AND lower(buyer.email)=i.parent_email)))))`;
}

export function grantedAccessSql(account: string) {
  return `(EXISTS(SELECT 1 FROM amp_access_gifts g WHERE g.account_id=${account} AND g.activated_at IS NOT NULL)
    OR EXISTS(SELECT 1 FROM amp_grants g JOIN amp_learners l ON l.id=g.learner_id WHERE l.account_id=${account}
      AND g.channel='pilot' AND g.status='active' AND g.starts_at<=now() AND g.ends_at>now())
    OR EXISTS(SELECT 1 FROM amp_commerce_orders o WHERE o.account_id=${account} AND o.grant_state IS NOT NULL))`;
}

-- Financial document data only. Never join this field into learning or ad reports.
ALTER TABLE amp_funding_requests ADD COLUMN student_billing_name text;
ALTER TABLE amp_funding_requests ADD CONSTRAINT funding_invoice_student_name CHECK (
  CASE WHEN offer_snapshot->>'documentPolicy' = 'named-student-invoice'
    THEN student_billing_name IS NOT NULL
      AND length(btrim(student_billing_name)) BETWEEN 1 AND 180
    ELSE student_billing_name IS NULL
  END
);

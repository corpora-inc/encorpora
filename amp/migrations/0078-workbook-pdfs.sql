-- Rendered workbook PDFs, a short-lived cache (RETENTION.workbookPdfHours).
-- Keyed by the exact printed document, so a changed renderer or learner name
-- renders again. Rows go with their workbook, which goes with the learner's
-- learning data.
CREATE TABLE amp_workbook_pdfs (
  workbook_id uuid NOT NULL REFERENCES amp_workbooks(id) ON DELETE CASCADE,
  format text NOT NULL CHECK (format IN ('Letter', 'A4')),
  document_sha256 text NOT NULL CHECK (document_sha256 ~ '^[0-9a-f]{64}$'),
  pdf bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workbook_id, format, document_sha256)
);
CREATE INDEX amp_workbook_pdfs_created_idx ON amp_workbook_pdfs(created_at);

-- Aggregate public campaign activity only. No identifiers, URLs, or learner data.
CREATE TABLE amp_campaign_daily (
  day date NOT NULL,
  state text NOT NULL CHECK (state='AR'),
  program text NOT NULL CHECK (program='arkansas-efa'),
  campaign text NOT NULL CHECK (campaign IN ('none','ar-efa-launch')),
  source text NOT NULL CHECK (source IN ('direct','facebook','instagram','google','email','youtube')),
  medium text NOT NULL CHECK (medium IN ('none','paid-social','cpc','email','organic-social')),
  action text NOT NULL CHECK (action IN ('landing_view','try_click','invoice_click')),
  count bigint NOT NULL CHECK (count>0),
  PRIMARY KEY(day,state,program,campaign,source,medium,action)
);

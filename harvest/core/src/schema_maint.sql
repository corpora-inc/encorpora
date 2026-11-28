-- Maintenance tables (optional; CONTRACT "Maintenance tables"). A pack without
-- them reads as before; the core detects each table on its own.
CREATE TABLE section_loc (section_id TEXT PRIMARY KEY,
                          page_label TEXT,               -- the printed page ('3-2')
                          page_index INTEGER,            -- the 1-based physical page of the source file
                          figure_label TEXT,
                          boxes TEXT);                   -- json [{x0,y0,x1,y1}], 0..1 on the page image
CREATE TABLE asset (asset_id TEXT PRIMARY KEY, path TEXT NOT NULL, sha256 TEXT NOT NULL,
                    media_type TEXT NOT NULL, bytes INTEGER NOT NULL, width INTEGER, height INTEGER);
CREATE TABLE section_asset (section_id TEXT NOT NULL, asset_id TEXT NOT NULL,
                            role TEXT NOT NULL,          -- figure|page
                            PRIMARY KEY (section_id, asset_id, role));
CREATE TABLE requirement (ref_kind TEXT NOT NULL,        -- procedure|fault_tree|fault_node
  ref_id TEXT NOT NULL, ord INTEGER NOT NULL,
  kind TEXT NOT NULL,                                    -- tool|part|consumable|personnel|condition|reference
  text TEXT NOT NULL, ident TEXT, qty TEXT, section_id TEXT, prov_id TEXT NOT NULL,
  PRIMARY KEY (ref_kind, ref_id, ord));
CREATE TABLE fault_tree (tree_id TEXT PRIMARY KEY, title TEXT NOT NULL, system TEXT,
  entry_node TEXT NOT NULL, section_ids TEXT NOT NULL, lang TEXT NOT NULL, prov_id TEXT NOT NULL);
CREATE TABLE fault_node (node_id TEXT PRIMARY KEY, tree_id TEXT NOT NULL,
  kind TEXT NOT NULL,                                    -- symptom|check|action|goto|escalate|end
  text TEXT NOT NULL,                                    -- verbatim: a substring of the section's text
  section_id TEXT NOT NULL,
  expect TEXT,                                           -- json: how a result is recorded
  target TEXT,                                           -- tree:<id>[#<node_id>] | procedure:<id> (goto; optional on action)
  proc_id TEXT,                                          -- the test procedure that answers the question
  lang TEXT NOT NULL, prov_id TEXT NOT NULL,
  reference TEXT);                                       -- the printed cross-reference, verbatim
CREATE TABLE fault_edge (from_node TEXT NOT NULL, ord INTEGER NOT NULL, label TEXT NOT NULL,
  cond TEXT,                                             -- json numeric predicate; null: label equality
  to_node TEXT NOT NULL, retry INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (from_node, ord));
CREATE TABLE fault_facet (node_id TEXT NOT NULL, facet TEXT NOT NULL, ord INTEGER NOT NULL,
  text TEXT NOT NULL, section_id TEXT NOT NULL, PRIMARY KEY (node_id, facet, ord));
CREATE TABLE symptom (symptom_id TEXT PRIMARY KEY, tree_id TEXT NOT NULL, title TEXT NOT NULL,
  system TEXT, synonyms TEXT NOT NULL, lang TEXT NOT NULL, prov_id TEXT NOT NULL);
CREATE TABLE signal_map (signal_kind TEXT NOT NULL, pattern TEXT NOT NULL, title TEXT NOT NULL,
  tree_id TEXT,                                          -- null: a cause with no tree; section_id says it
  node_id TEXT, section_id TEXT, quote TEXT, prov_id TEXT NOT NULL,
  PRIMARY KEY (signal_kind, pattern, tree_id));
CREATE TABLE equip_attr (equip_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL,
                         PRIMARY KEY (equip_id, key));
CREATE TABLE equip_ident (equip_id TEXT NOT NULL,
                          kind TEXT NOT NULL,            -- serial_range|model|firmware|param|text
                          pattern TEXT NOT NULL, PRIMARY KEY (equip_id, kind, pattern));
CREATE TABLE history (event_id TEXT PRIMARY KEY, equip_id TEXT NOT NULL, system TEXT,
  date TEXT NOT NULL, text TEXT NOT NULL, source_id TEXT, attrs TEXT NOT NULL);
CREATE TABLE failure_mode (mode_id TEXT PRIMARY KEY, equip_id TEXT NOT NULL, system TEXT,
  title TEXT NOT NULL, count INTEGER NOT NULL, share REAL, tree_id TEXT, examples TEXT NOT NULL);

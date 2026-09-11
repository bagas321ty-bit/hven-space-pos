-- Shared POS snapshot for tablet ↔ laptop sync (one venue row).
create table if not exists pos_cloud (
  id         text primary key,
  rev        integer not null default 0,
  updated_at timestamptz not null default now(),
  device     text not null default '',
  payload    text not null
);

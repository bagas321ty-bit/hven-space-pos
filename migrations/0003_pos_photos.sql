-- Attendance proof photos, stored apart from the POS snapshot so sync stays small.
create table if not exists pos_photos (
  id         text primary key,
  data       text not null,
  updated_at timestamptz not null default now()
);

-- Remedi initial schema
-- Scope: database schema ONLY. No clinical scoring lives here — food-condition
-- helpfulness, multi-condition reconciliation, interaction scores, and allergen
-- filtering are all computed at runtime by the external Nutridigm API. Recipe
-- content comes from an external recipe API and is cached in `recipes`.
--
-- "Trimmed to current usage": speculative tables (subscriptions, meal_plan_entries,
-- user_preferences, foods, recipe_foods) and their enums are intentionally omitted
-- until a feature needs them. profiles.subscription_tier is kept as a placeholder.

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
do $$ begin
  create type meal_slot as enum ('breakfast', 'lunch', 'dinner', 'snack');
exception when duplicate_object then null; end $$;

do $$ begin
  create type match_tier as enum ('top', 'strong', 'good');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pick_status as enum ('shown', 'accepted', 'dismissed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type swipe_verdict as enum ('like', 'pass');
exception when duplicate_object then null; end $$;

do $$ begin
  create type subscription_tier as enum ('free', 'pro', 'founding');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- REFERENCE TABLES (public/authenticated read, no public write)
-- ---------------------------------------------------------------------------

create table if not exists conditions (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text unique not null,
  nutridigm_id text,
  category     text,
  created_at   timestamptz default now()
);

create table if not exists allergens (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text unique not null,
  created_at timestamptz default now()
);

create table if not exists dietary_restrictions (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text unique not null,
  created_at timestamptz default now()
);

create table if not exists recipes (
  id                  uuid primary key default gen_random_uuid(),
  source              text not null,
  external_id         text,
  title               text not null,
  image_url           text,
  meal_types          meal_slot[],
  cuisine_type        text,
  dish_type           text,
  ingredients         jsonb,
  prep_time_minutes   int,
  source_url          text,
  is_calibration_dish boolean default false,
  calibration_order   int,
  created_at          timestamptz default now(),
  unique (source, external_id)
);

-- ---------------------------------------------------------------------------
-- USER-DATA TABLES (RLS, owner-only)
-- ---------------------------------------------------------------------------

create table if not exists profiles (
  id                        uuid primary key references auth.users(id) on delete cascade,
  display_name              text,
  subscription_tier         subscription_tier default 'free',
  onboarding_completed      boolean default false,
  taste_calibration_completed boolean default false,
  created_at                timestamptz default now(),
  updated_at                timestamptz default now()
);

create table if not exists user_conditions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references profiles(id) on delete cascade,
  condition_id uuid references conditions(id),
  created_at   timestamptz default now(),
  unique (user_id, condition_id)
);

create table if not exists user_allergens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles(id) on delete cascade,
  allergen_id uuid references allergens(id),
  created_at  timestamptz default now(),
  unique (user_id, allergen_id)
);

create table if not exists user_dietary_restrictions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references profiles(id) on delete cascade,
  restriction_id uuid references dietary_restrictions(id),
  created_at     timestamptz default now(),
  unique (user_id, restriction_id)
);

create table if not exists taste_swipes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references profiles(id) on delete cascade,
  recipe_id  uuid references recipes(id),
  verdict    swipe_verdict not null,
  created_at timestamptz default now(),
  unique (user_id, recipe_id)
);

-- tier_label and reference_count are snapshots of the Nutridigm response at
-- generation time, NOT computed here.
create table if not exists daily_picks (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references profiles(id) on delete cascade,
  pick_date       date not null,
  meal_slot       meal_slot not null,
  recipe_id       uuid references recipes(id),
  rank            int not null,
  tier_label      match_tier not null,
  reference_count int not null default 0,
  status          pick_status not null default 'shown',
  created_at      timestamptz default now(),
  unique (user_id, pick_date, meal_slot, rank)
);

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

-- Reference tables: read-only to anon + authenticated, no write policy.
alter table conditions            enable row level security;
alter table allergens             enable row level security;
alter table dietary_restrictions  enable row level security;
alter table recipes               enable row level security;

drop policy if exists "conditions_read"           on conditions;
drop policy if exists "allergens_read"            on allergens;
drop policy if exists "dietary_restrictions_read" on dietary_restrictions;
drop policy if exists "recipes_read"              on recipes;

create policy "conditions_read"           on conditions           for select to anon, authenticated using (true);
create policy "allergens_read"            on allergens            for select to anon, authenticated using (true);
create policy "dietary_restrictions_read" on dietary_restrictions for select to anon, authenticated using (true);
create policy "recipes_read"              on recipes              for select to anon, authenticated using (true);

-- profiles: owner-only, keyed by id = auth.uid()
alter table profiles enable row level security;
drop policy if exists "profiles_select" on profiles;
drop policy if exists "profiles_insert" on profiles;
drop policy if exists "profiles_update" on profiles;
drop policy if exists "profiles_delete" on profiles;
create policy "profiles_select" on profiles for select using (id = auth.uid());
create policy "profiles_insert" on profiles for insert with check (id = auth.uid());
create policy "profiles_update" on profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_delete" on profiles for delete using (id = auth.uid());

-- owner-only tables keyed by user_id = auth.uid()
do $$
declare t text;
begin
  foreach t in array array[
    'user_conditions',
    'user_allergens',
    'user_dietary_restrictions',
    'taste_swipes',
    'daily_picks'
  ]
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists %I on %I;', t || '_select', t);
    execute format('drop policy if exists %I on %I;', t || '_insert', t);
    execute format('drop policy if exists %I on %I;', t || '_update', t);
    execute format('drop policy if exists %I on %I;', t || '_delete', t);
    execute format('create policy %I on %I for select using (user_id = auth.uid());', t || '_select', t);
    execute format('create policy %I on %I for insert with check (user_id = auth.uid());', t || '_insert', t);
    execute format('create policy %I on %I for update using (user_id = auth.uid()) with check (user_id = auth.uid());', t || '_update', t);
    execute format('create policy %I on %I for delete using (user_id = auth.uid());', t || '_delete', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- AUTH TRIGGER: auto-create a profile row for every new auth user
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- SEED DATA (reference tables)
-- ---------------------------------------------------------------------------

-- Allergens: FDA "Big 9"
insert into allergens (name, slug) values
  ('Milk',                'milk'),
  ('Eggs',                'eggs'),
  ('Fish',                'fish'),
  ('Crustacean shellfish','crustacean-shellfish'),
  ('Tree nuts',           'tree-nuts'),
  ('Peanuts',             'peanuts'),
  ('Wheat',               'wheat'),
  ('Soybeans',            'soybeans'),
  ('Sesame',              'sesame')
on conflict (slug) do nothing;

-- Dietary restrictions
insert into dietary_restrictions (name, slug) values
  ('Vegetarian',  'vegetarian'),
  ('Vegan',       'vegan'),
  ('Pescatarian', 'pescatarian'),
  ('Halal',       'halal'),
  ('Kosher',      'kosher'),
  ('Gluten-free', 'gluten-free'),
  ('Dairy-free',  'dairy-free')
on conflict (slug) do nothing;

-- conditions: intentionally left empty — synced from Nutridigm separately.

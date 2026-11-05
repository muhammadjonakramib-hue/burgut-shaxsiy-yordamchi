-- Burgut: foydalanuvchiga tegishli lug‘at takrorlash ma’lumotlari.
-- Supabase SQL Editor’da bir marta ishga tushiring.

create table if not exists public.vocab_cards (
  user_id uuid not null references auth.users(id) on delete cascade,
  word_key text not null,
  lang text not null check (lang in ('tr', 'en')),
  word text not null,
  due_at timestamptz not null,
  interval_days integer not null default 0 check (interval_days >= 0 and interval_days <= 3650),
  review_level integer not null default 0 check (review_level >= 0 and review_level <= 20),
  last_rating text check (last_rating in ('wrong', 'hard', 'correct')),
  attempts integer not null default 0 check (attempts >= 0),
  lapses integer not null default 0 check (lapses >= 0),
  last_reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, word_key)
);

create table if not exists public.vocab_reviews (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  word_key text not null,
  lang text not null check (lang in ('tr', 'en')),
  word text not null,
  rating text not null check (rating in ('wrong', 'hard', 'correct')),
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists vocab_cards_due_idx on public.vocab_cards(user_id, due_at);
create index if not exists vocab_reviews_word_idx on public.vocab_reviews(user_id, word_key, reviewed_at desc);

alter table public.vocab_cards enable row level security;
alter table public.vocab_reviews enable row level security;

drop policy if exists "vocab cards own rows" on public.vocab_cards;
create policy "vocab cards own rows" on public.vocab_cards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "vocab reviews own rows" on public.vocab_reviews;
create policy "vocab reviews own rows" on public.vocab_reviews
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Xarajat budjeti ham keyin shu login bilan qurilmalarda sinxronlanadi.
create table if not exists public.budgets (
  user_id uuid not null references auth.users(id) on delete cascade,
  month date not null,
  currency text not null check (currency in ('TRY', 'USD')),
  spending_limit numeric(18,2) not null default 0 check (spending_limit >= 0),
  income numeric(18,2) not null default 0 check (income >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, month, currency)
);

alter table public.budgets enable row level security;
drop policy if exists "budgets own rows" on public.budgets;
create policy "budgets own rows" on public.budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

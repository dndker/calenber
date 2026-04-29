create table if not exists public.subscription_event_favorites (
    id uuid primary key default gen_random_uuid(),
    calendar_id uuid not null references public.calendars (id) on delete cascade,
    event_id text not null,
    user_id uuid not null references auth.users (id) on delete cascade,
    created_at timestamptz not null default now(),
    unique (calendar_id, event_id, user_id)
);

create index if not exists subscription_event_favorites_user_created_idx on public.subscription_event_favorites (user_id, created_at desc, calendar_id);
create index if not exists subscription_event_favorites_calendar_event_idx on public.subscription_event_favorites (calendar_id, event_id);

alter table public.subscription_event_favorites enable row level security;

drop policy if exists "members can view own subscription event favorites" on public.subscription_event_favorites;
create policy "members can view own subscription event favorites" on public.subscription_event_favorites
for select
to authenticated
using (
    user_id = auth.uid()
    and public.is_active_calendar_member(calendar_id)
);

drop policy if exists "members can manage own subscription event favorites" on public.subscription_event_favorites;
create policy "members can manage own subscription event favorites" on public.subscription_event_favorites
for all
to authenticated
using (
    user_id = auth.uid()
    and public.is_active_calendar_member(calendar_id)
)
with check (
    user_id = auth.uid()
    and public.is_active_calendar_member(calendar_id)
);

-- ================================
-- 1. profiles (유저 확장)
-- ================================
create table profiles (
    user_id uuid primary key references auth.users (id) on delete cascade,
    plan text default 'free', -- free / pro / team
    status text default 'active',
    created_at timestamptz default now()
);

-- ================================
-- 2. calendar role enum
-- ================================
create type calendar_role as enum('viewer', 'editor', 'manager', 'owner');

-- ================================
-- 3. calendars
-- ================================
create table calendars (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    created_by uuid references auth.users (id),
    created_at timestamptz default now()
);

-- ================================
-- 4. calendar_members
-- ================================
create table calendar_members (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users (id) on delete cascade,
    calendar_id uuid references calendars (id) on delete cascade,
    role calendar_role default 'owner',
    created_at timestamptz default now(),
    unique (user_id, calendar_id)
);

-- ================================
-- 5. events
-- ================================
create table events (
    id uuid primary key default gen_random_uuid(),
    calendar_id uuid references calendars (id) on delete cascade,
    title text not null,
    description text,
    start_at timestamptz,
    end_at timestamptz,
    created_by uuid references auth.users (id),
    created_at timestamptz default now()
);

-- ================================
-- 6. 신규 유저 → 자동 생성 트리거
-- ================================
create function handle_new_user () returns trigger as $$
declare
  new_calendar_id uuid;
begin
  -- profile 생성
  insert into profiles (user_id)
  values (new.id);

  -- 캘린더 생성
  insert into calendars (name, created_by)
  values ('My Calendar', new.id)
  returning id into new_calendar_id;

  -- 멤버 연결
  insert into calendar_members (user_id, calendar_id, role)
  values (new.id, new_calendar_id, 'owner');

  return new;
end;
$$ language plpgsql;

create trigger on_auth_user_created
after insert on auth.users for each row
execute function handle_new_user ();

alter table calendars enable row level security;

create policy "users can view their calendars" on calendars for
select
    using (
        id in (
            select
                calendar_id
            from
                calendar_members
            where
                user_id = auth.uid ()
        )
    );

alter table calendar_members enable row level security;

create policy "users can view members" on calendar_members for
select
    using (
        calendar_id in (
            select
                calendar_id
            from
                calendar_members
            where
                user_id = auth.uid ()
        )
    );

alter table events enable row level security;

create policy "users can access events" on events for all using (
    calendar_id in (
        select
            calendar_id
        from
            calendar_members
        where
            user_id = auth.uid ()
    )
);

alter table profiles enable row level security;

create policy "users can access own profile" on profiles for all using (user_id = auth.uid ());

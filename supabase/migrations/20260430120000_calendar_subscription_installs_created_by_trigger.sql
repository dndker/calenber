-- ================================================================
-- calendar_subscription_installs.created_by 가 비어 있는 이유:
-- 컬럼은 nullable 이고 클라 upsert 에 created_by 를 넣지 않았기 때문이다.
-- INSERT 시 auth.uid() 로 채운다 (감사/표시용; 서버 신뢰 트리거).
-- ================================================================
create or replace function public.set_calendar_subscription_install_created_by ()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists set_calendar_subscription_install_created_by on public.calendar_subscription_installs;

create trigger set_calendar_subscription_install_created_by
before insert on public.calendar_subscription_installs
for each row
execute function public.set_calendar_subscription_install_created_by ();

-- event_history INSERT → event_updated / event_created / event_deleted 알림 자동 생성
--
-- 설계 원칙:
--   1. debounce 수정(클라이언트 자동 저장)은 digest_key 중복으로 자동 집계됨.
--      같은 digest_key가 30초 내 재진입해도 notification_digests.count++ 만 됨.
--   2. 자기 자신(actor = calendar owner/single user) 제외: actor = recipient 인 경우 스킵.
--   3. service_role create_notification RPC 호출 → Row 삽입 + digest upsert 원자 처리.
--   4. 캘린더 멤버 전원에게 발송 (active members).

-- ─────────────────────────────────────────────────────────────────────────────
-- 트리거 함수
-- ─────────────────────────────────────────────────────────────────────────────
drop function if exists public.notify_event_history_insert();

create or replace function public.notify_event_history_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec              public.event_history;
  notif_type       text;
  entity_type_val  text := 'event';
  metadata_val     jsonb;
  member_row       record;
  actor_name_val   text;
  actor_avatar_val text;
  event_title_val  text;
  changed_fields   text[];
begin
  rec := new;

  -- action → notification_type 매핑
  notif_type := case rec.action
    when 'created' then 'event_created'
    when 'updated' then 'event_updated'
    when 'deleted' then 'event_deleted'
    else null
  end;

  if notif_type is null then
    return new;
  end if;

  -- actor 프로필 조회
  select
    nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
    nullif(trim(u.raw_user_meta_data ->> 'avatar_url'), '')
  into actor_name_val, actor_avatar_val
  from auth.users u
  where u.id = rec.actor_user_id;

  -- 일정 제목 조회 (deleted 시에는 history summary 사용)
  select title into event_title_val
  from public.events
  where id = rec.event_id;

  if event_title_val is null then
    -- 삭제된 일정: summary에서 제목 추출 시도
    event_title_val := rec.summary;
  end if;

  -- 변경 필드 목록 (updated 시)
  if rec.action = 'updated' and rec.changes is not null then
    select array_agg(elem ->> 'field')
    into changed_fields
    from jsonb_array_elements(rec.changes) as elem
    where elem ->> 'field' is not null;
  end if;

  metadata_val := jsonb_build_object(
    'title',          coalesce(event_title_val, ''),
    'actorName',      coalesce(actor_name_val, ''),
    'actorAvatarUrl', coalesce(actor_avatar_val, ''),
    'changedFields',  coalesce(to_jsonb(changed_fields), '[]'::jsonb)
  );

  -- 캘린더의 활성 멤버 전원에게 알림 생성 (actor 본인 제외)
  for member_row in
    select cm.user_id
    from public.calendar_members cm
    where cm.calendar_id = rec.calendar_id
      and cm.status = 'active'
      and cm.user_id is distinct from rec.actor_user_id
  loop
    begin
      perform public.create_notification(
        p_recipient_id      := member_row.user_id,
        p_actor_id          := rec.actor_user_id,
        p_notification_type := notif_type,
        p_entity_type       := entity_type_val,
        p_entity_id         := rec.event_id::text,
        p_calendar_id       := rec.calendar_id,
        p_metadata          := metadata_val
      );
    exception when others then
      -- 알림 생성 실패가 본 트랜잭션을 롤백하지 않도록 예외를 삼킨다
      raise warning '[notify_event_history] create_notification failed for recipient %: %', member_row.user_id, sqlerrm;
    end;
  end loop;

  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 트리거 등록
-- ─────────────────────────────────────────────────────────────────────────────
drop trigger if exists on_event_history_insert_notify on public.event_history;

create trigger on_event_history_insert_notify
after insert on public.event_history
for each row
execute function public.notify_event_history_insert();




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."calendar_access_mode" AS ENUM (
    'public_open',
    'public_approval',
    'private'
);


ALTER TYPE "public"."calendar_access_mode" OWNER TO "postgres";


CREATE TYPE "public"."calendar_event_status" AS ENUM (
    'scheduled',
    'in_progress',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."calendar_event_status" OWNER TO "postgres";


CREATE TYPE "public"."calendar_member_status" AS ENUM (
    'active',
    'pending'
);


ALTER TYPE "public"."calendar_member_status" OWNER TO "postgres";


CREATE TYPE "public"."calendar_role" AS ENUM (
    'viewer',
    'editor',
    'manager',
    'owner'
);


ALTER TYPE "public"."calendar_role" OWNER TO "postgres";


CREATE TYPE "public"."event_history_action" AS ENUM (
    'created',
    'updated',
    'deleted'
);


ALTER TYPE "public"."event_history_action" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."broadcast_calendar_event_category_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  target_calendar_id uuid := coalesce(new.calendar_id, old.calendar_id);
  target_category_id uuid := coalesce(new.id, old.id);
  target_topic text := public.get_calendar_workspace_topic(target_calendar_id);
  target_is_private boolean := public.is_calendar_workspace_topic_private(target_calendar_id);
  target_event_name text;
  target_payload jsonb;
begin
  target_event_name := case tg_op
    when 'INSERT' then 'calendar.event-category.created'
    when 'UPDATE' then 'calendar.event-category.updated'
    when 'DELETE' then 'calendar.event-category.deleted'
    else 'calendar.event-category.changed'
  end;

  target_payload := jsonb_build_object(
    'entity', 'event_category',
    'operation', lower(tg_op),
    'calendarId', target_calendar_id,
    'categoryId', target_category_id,
    'occurredAt', timezone('utc', now())
  );

  if tg_op = 'DELETE' then
    target_payload := target_payload || jsonb_build_object(
      'record',
      jsonb_build_object(
        'id', old.id,
        'calendar_id', old.calendar_id
      )
    );
  else
    target_payload := target_payload || jsonb_build_object(
      'record',
      public.build_calendar_event_category_realtime_record(target_category_id)
    );
  end if;

  perform realtime.send(
    target_payload,
    target_event_name,
    target_topic,
    target_is_private
  );

  return null;
end;
$$;


ALTER FUNCTION "public"."broadcast_calendar_event_category_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."broadcast_calendar_event_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  target_calendar_id uuid := coalesce(new.calendar_id, old.calendar_id);
  target_event_id uuid := coalesce(new.id, old.id);
  target_topic text := public.get_calendar_workspace_topic(target_calendar_id);
  target_is_private boolean := public.is_calendar_workspace_topic_private(target_calendar_id);
  target_event_name text;
  target_payload jsonb;
begin
  target_event_name := case tg_op
    when 'INSERT' then 'calendar.event.created'
    when 'UPDATE' then 'calendar.event.updated'
    when 'DELETE' then 'calendar.event.deleted'
    else 'calendar.event.changed'
  end;

  target_payload := jsonb_build_object(
    'entity', 'event',
    'operation', lower(tg_op),
    'calendarId', target_calendar_id,
    'eventId', target_event_id,
    'occurredAt', timezone('utc', now())
  );

  if tg_op = 'DELETE' then
    target_payload := target_payload || jsonb_build_object(
      'record',
      jsonb_build_object(
        'id', old.id,
        'calendar_id', old.calendar_id
      )
    );
  else
    target_payload := target_payload || jsonb_build_object(
      'record',
      public.build_calendar_event_realtime_record(target_event_id)
    );
  end if;

  perform realtime.send(
    target_payload,
    target_event_name,
    target_topic,
    target_is_private
  );

  return null;
end;
$$;


ALTER FUNCTION "public"."broadcast_calendar_event_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."broadcast_calendar_settings_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  target_topic text := public.get_calendar_workspace_topic(new.id);
  target_is_private boolean := public.is_calendar_workspace_topic_private(new.id);
begin
  if old.name is not distinct from new.name
     and old.avatar_url is not distinct from new.avatar_url
     and old.access_mode is not distinct from new.access_mode
     and old.event_layout is not distinct from new.event_layout
     and old.event_field_settings is not distinct from new.event_field_settings
     and old.layout_options is not distinct from new.layout_options then
    return null;
  end if;

  perform realtime.send(
    jsonb_build_object(
      'entity', 'calendar_settings',
      'operation', 'update',
      'calendarId', new.id,
      'occurredAt', timezone('utc', now()),
      'record', public.build_calendar_settings_realtime_record(new.id)
    ),
    'calendar.settings.updated',
    target_topic,
    target_is_private
  );

  return null;
end;
$$;


ALTER FUNCTION "public"."broadcast_calendar_settings_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."broadcast_subscription_catalog_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  catalog_topic text := 'subscription:catalog:' || new.id::text;
  payload jsonb;
begin
  -- source_type이 shared_category이고 status 또는 is_active가 바뀐 경우만 처리
  if new.source_type != 'shared_category' then
    return new;
  end if;

  if old.status = new.status and old.is_active = new.is_active then
    return new;
  end if;

  payload := jsonb_build_object(
    'entity', 'subscription_catalog',
    'operation', 'updated',
    'catalogId', new.id,
    'status', new.status,
    'isActive', new.is_active,
    'occurredAt', timezone('utc', now())
  );

  perform realtime.send(
    payload,
    'subscription.catalog.updated',
    catalog_topic,
    true
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."broadcast_subscription_catalog_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."broadcast_subscription_event_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  target_calendar_id uuid := coalesce(new.calendar_id, old.calendar_id);
  target_category_id uuid := coalesce(new.category_id, old.category_id);
  target_event_id    uuid := coalesce(new.id, old.id);
  catalog_rec record;
  catalog_topic text;
  payload jsonb;
  event_name text;
begin
  -- 이 이벤트가 shared_category 구독의 원본 카테고리에 속하는지 확인
  -- 없으면 바로 리턴 (불필요한 loop 방지)
  if not exists (
    select 1
    from public.calendar_subscription_catalogs
    where source_calendar_id = target_calendar_id
      and source_category_id = target_category_id
      and source_type = 'shared_category'
      and is_active = true
      and status = 'active'
  ) then
    return null;
  end if;

  event_name := case tg_op
    when 'INSERT' then 'calendar.event.created'
    when 'UPDATE' then 'calendar.event.updated'
    when 'DELETE' then 'calendar.event.deleted'
    else 'calendar.event.changed'
  end;

  payload := jsonb_build_object(
    'entity', 'subscription_event',
    'operation', lower(tg_op),
    'sourceCalendarId', target_calendar_id,
    'sourceCategoryId', target_category_id,
    'eventId', target_event_id,
    'occurredAt', timezone('utc', now())
  );

  -- 해당 카테고리를 소스로 가진 모든 카탈로그에 broadcast
  for catalog_rec in
    select id
    from public.calendar_subscription_catalogs
    where source_calendar_id = target_calendar_id
      and source_category_id = target_category_id
      and source_type = 'shared_category'
      and is_active = true
      and status = 'active'
  loop
    catalog_topic := 'subscription:catalog:' || catalog_rec.id::text;

    perform realtime.send(
      payload || jsonb_build_object('catalogId', catalog_rec.id),
      event_name,
      catalog_topic,
      true
    );
  end loop;

  return null;
end;
$$;


ALTER FUNCTION "public"."broadcast_subscription_event_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."build_calendar_event_category_realtime_record"("target_category_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select jsonb_build_object(
    'id', categories.id,
    'calendar_id', categories.calendar_id,
    'name', categories.name,
    'options', categories.options,
    'created_by', categories.created_by,
    'created_at', categories.created_at,
    'updated_at', categories.updated_at
  )
  from public.event_categories as categories
  where categories.id = target_category_id;
$$;


ALTER FUNCTION "public"."build_calendar_event_category_realtime_record"("target_category_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."event_category_matches_calendar"("target_category_id" "uuid", "target_calendar_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select
    target_category_id is null
    or exists (
      select 1
      from public.event_categories as categories
      where categories.id = target_category_id
        and categories.calendar_id = target_calendar_id
    );
$$;


ALTER FUNCTION "public"."event_category_matches_calendar"("target_category_id" "uuid", "target_calendar_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_valid_event_exceptions"("target" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
declare
  exception_value jsonb;
begin
  if target is null then
    return true;
  end if;

  if jsonb_typeof(target) <> 'array' then
    return false;
  end if;

  for exception_value in
    select value
    from jsonb_array_elements(target)
  loop
    if jsonb_typeof(exception_value) <> 'string' then
      return false;
    end if;

    perform (exception_value #>> '{}')::timestamptz;
  end loop;

  return true;
exception
  when others then
    return false;
end;
$$;


ALTER FUNCTION "public"."is_valid_event_exceptions"("target" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_valid_event_recurrence"("target" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
declare
  recurrence_type text;
  interval_value integer;
  weekday_value jsonb;
begin
  if target is null then
    return true;
  end if;

  if jsonb_typeof(target) <> 'object' then
    return false;
  end if;

  recurrence_type := target ->> 'type';

  if recurrence_type not in ('daily', 'weekly', 'monthly', 'yearly') then
    return false;
  end if;

  if jsonb_typeof(target -> 'interval') <> 'number' then
    return false;
  end if;

  interval_value := (target ->> 'interval')::integer;

  if interval_value < 1 then
    return false;
  end if;

  if target ? 'until' and nullif(target ->> 'until', '') is null then
    return false;
  end if;

  if target ? 'count' and ((target ->> 'count')::integer < 1) then
    return false;
  end if;

  if target ? 'until' and target ? 'count' then
    return false;
  end if;

  if target ? 'byWeekday' then
    if jsonb_typeof(target -> 'byWeekday') <> 'array' then
      return false;
    end if;

    if recurrence_type <> 'weekly' then
      return false;
    end if;

    for weekday_value in
      select value
      from jsonb_array_elements(target -> 'byWeekday')
    loop
      if jsonb_typeof(weekday_value) <> 'number' then
        return false;
      end if;

      if (weekday_value #>> '{}')::integer < 0 or (weekday_value #>> '{}')::integer > 6 then
        return false;
      end if;
    end loop;
  elsif recurrence_type = 'weekly' then
    return false;
  end if;

  return true;
exception
  when others then
    return false;
end;
$$;


ALTER FUNCTION "public"."is_valid_event_recurrence"("target" "jsonb") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "calendar_id" "uuid",
    "title" "text" NOT NULL,
    "content" "jsonb",
    "start_at" timestamp with time zone,
    "end_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_locked" boolean DEFAULT false NOT NULL,
    "status" "public"."calendar_event_status" DEFAULT 'scheduled'::"public"."calendar_event_status" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    "category_id" "uuid",
    "recurrence" "jsonb",
    "exceptions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "all_day" boolean DEFAULT false NOT NULL,
    "timezone" "text" DEFAULT 'Asia/Seoul'::"text" NOT NULL,
    CONSTRAINT "events_category_matches_calendar_check" CHECK ("public"."event_category_matches_calendar"("category_id", "calendar_id")),
    CONSTRAINT "events_exceptions_valid_check" CHECK ("public"."is_valid_event_exceptions"("exceptions")),
    CONSTRAINT "events_recurrence_valid_check" CHECK ("public"."is_valid_event_recurrence"("recurrence"))
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."build_calendar_event_history_changes"("old_event" "public"."events", "new_event" "public"."events", "operation" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  changes jsonb := '[]'::jsonb;
begin
  if operation = 'INSERT' then
    return jsonb_build_array(
      jsonb_build_object(
        'field', 'event',
        'label', '일정',
        'op', 'added',
        'after', jsonb_build_object(
          'title', new_event.title,
          'start_at', new_event.start_at,
          'end_at', new_event.end_at,
          'all_day', new_event.all_day,
          'timezone', new_event.timezone,
          'status', new_event.status,
          'category_id', new_event.category_id,
          'recurrence', new_event.recurrence,
          'exceptions', new_event.exceptions
        )
      )
    );
  end if;

  if operation = 'DELETE' then
    return jsonb_build_array(
      jsonb_build_object(
        'field', 'event',
        'label', '일정',
        'op', 'removed',
        'before', jsonb_build_object(
          'title', old_event.title,
          'start_at', old_event.start_at,
          'end_at', old_event.end_at,
          'all_day', old_event.all_day,
          'timezone', old_event.timezone,
          'status', old_event.status,
          'category_id', old_event.category_id,
          'recurrence', old_event.recurrence,
          'exceptions', old_event.exceptions
        )
      )
    );
  end if;

  if old_event.title is distinct from new_event.title then
    changes := changes || jsonb_build_array(
      public.build_event_history_change(
        'title',
        '제목',
        to_jsonb(old_event.title),
        to_jsonb(new_event.title)
      )
    );
  end if;

  if old_event.content is distinct from new_event.content then
    changes := changes || jsonb_build_array(
      public.build_event_history_change(
        'content',
        '내용',
        null,
        null,
        false
      )
    );
  end if;

  if old_event.start_at is distinct from new_event.start_at then
    changes := changes || jsonb_build_array(
      public.build_event_history_change(
        'start_at',
        '시작 시간',
        to_jsonb(old_event.start_at),
        to_jsonb(new_event.start_at)
      )
    );
  end if;

  if old_event.end_at is distinct from new_event.end_at then
    changes := changes || jsonb_build_array(
      public.build_event_history_change(
        'end_at',
        '종료 시간',
        to_jsonb(old_event.end_at),
        to_jsonb(new_event.end_at)
      )
    );
  end if;

  if old_event.all_day is distinct from new_event.all_day then
    changes := changes || jsonb_build_array(
      public.build_event_history_change(
        'all_day',
        '하루종일',
        to_jsonb(old_event.all_day),
        to_jsonb(new_event.all_day)
      )
    );
  end if;

  if old_event.timezone is distinct from new_event.timezone then
    changes := changes || jsonb_build_array(
      public.build_event_history_change(
        'timezone',
        '시간대',
        to_jsonb(old_event.timezone),
        to_jsonb(new_event.timezone)
      )
    );
  end if;

  if old_event.category_id is distinct from new_event.category_id then
    changes := changes || jsonb_build_array(
      public.build_event_history_change(
        'category_id',
        '카테고리',
        to_jsonb(old_event.category_id),
        to_jsonb(new_event.category_id)
      )
    );
  end if;

  if old_event.recurrence is distinct from new_event.recurrence then
    changes := changes || jsonb_build_array(
      public.build_event_history_change(
        'recurrence',
        '반복',
        old_event.recurrence,
        new_event.recurrence
      )
    );
  end if;

  if old_event.exceptions is distinct from new_event.exceptions then
    changes := changes || jsonb_build_array(
      public.build_event_history_change(
        'exceptions',
        '예외',
        old_event.exceptions,
        new_event.exceptions
      )
    );
  end if;

  if old_event.status is distinct from new_event.status then
    changes := changes || jsonb_build_array(
      public.build_event_history_change(
        'status',
        '상태',
        to_jsonb(old_event.status),
        to_jsonb(new_event.status)
      )
    );
  end if;

  if old_event.is_locked is distinct from new_event.is_locked then
    changes := changes || jsonb_build_array(
      public.build_event_history_change(
        'is_locked',
        '잠금',
        to_jsonb(old_event.is_locked),
        to_jsonb(new_event.is_locked)
      )
    );
  end if;

  return changes;
end;
$$;


ALTER FUNCTION "public"."build_calendar_event_history_changes"("old_event" "public"."events", "new_event" "public"."events", "operation" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."build_calendar_event_history_summary"("target_action" "public"."event_history_action", "target_changes" "jsonb") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
declare
  change_count integer := coalesce(jsonb_array_length(target_changes), 0);
  first_field text := target_changes -> 0 ->> 'field';
begin
  if target_action = 'created' then
    return '일정을 생성했습니다.';
  end if;

  if target_action = 'deleted' then
    return '일정을 삭제했습니다.';
  end if;

  if change_count <= 0 then
    return '일정을 수정했습니다.';
  end if;

  if change_count > 1 then
    return format('%s개 항목을 변경했습니다.', change_count);
  end if;

  return case first_field
    when 'title' then '제목을 변경했습니다.'
    when 'content' then '내용을 변경했습니다.'
    when 'start_at' then '시작 시간을 변경했습니다.'
    when 'end_at' then '종료 시간을 변경했습니다.'
    when 'all_day' then '하루종일 여부를 변경했습니다.'
    when 'timezone' then '시간대를 변경했습니다.'
    when 'category_id' then '카테고리를 변경했습니다.'
    when 'recurrence' then '반복 규칙을 변경했습니다.'
    when 'exceptions' then '예외 일정을 변경했습니다.'
    when 'status' then '상태를 변경했습니다.'
    when 'is_locked' then '잠금 상태를 변경했습니다.'
    else '일정을 수정했습니다.'
  end;
end;
$$;


ALTER FUNCTION "public"."build_calendar_event_history_summary"("target_action" "public"."event_history_action", "target_changes" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."build_calendar_event_realtime_record"("target_event_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select jsonb_build_object(
    'id', events.id,
    'calendar_id', events.calendar_id,
    'title', events.title,
    'content', events.content,
    'start_at', events.start_at,
    'end_at', events.end_at,
    'all_day', events.all_day,
    'timezone', events.timezone,
    'categories', public.get_event_categories_json(events.id, true),
    'category_id', events.category_id,
    'category_name', primary_category.name,
    'category_created_by', primary_category.created_by,
    'category_created_at', primary_category.created_at,
    'category_updated_at', primary_category.updated_at,
    'recurrence', events.recurrence,
    'exceptions', events.exceptions,
    'participants', public.get_event_participants_json(events.id, true),
    'is_favorite', coalesce(event_favorites.id is not null, false),
    'favorited_at', event_favorites.created_at,
    'status', events.status,
    'created_by', events.created_by,
    'updated_by', events.updated_by,
    'is_locked', events.is_locked,
    'created_at', events.created_at,
    'updated_at', events.updated_at,
    'creator_name', nullif(trim(creators.raw_user_meta_data ->> 'name'), '')::text,
    'creator_email', creators.email::text,
    'creator_avatar_url', nullif(trim(creators.raw_user_meta_data ->> 'avatar_url'), '')::text,
    'updater_name', nullif(trim(updaters.raw_user_meta_data ->> 'name'), '')::text,
    'updater_email', updaters.email::text,
    'updater_avatar_url', nullif(trim(updaters.raw_user_meta_data ->> 'avatar_url'), '')::text
  )
  from public.events as events
  left join public.event_categories as primary_category on primary_category.id = events.category_id
  left join auth.users as creators on creators.id = events.created_by
  left join auth.users as updaters on updaters.id = events.updated_by
  left join public.event_favorites as event_favorites
    on event_favorites.event_id = events.id
    and event_favorites.user_id = auth.uid()
  where events.id = target_event_id;
$$;


ALTER FUNCTION "public"."build_calendar_event_realtime_record"("target_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."build_calendar_settings_realtime_record"("target_calendar_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select jsonb_build_object(
    'id', calendars.id,
    'name', calendars.name,
    'avatar_url', calendars.avatar_url,
    'access_mode', calendars.access_mode,
    'event_layout', calendars.event_layout,
    'event_field_settings', calendars.event_field_settings,
    'layout_options', calendars.layout_options,
    'updated_at', calendars.updated_at
  )
  from public.calendars as calendars
  where calendars.id = target_calendar_id;
$$;


ALTER FUNCTION "public"."build_calendar_settings_realtime_record"("target_calendar_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."build_event_history_change"("field_name" "text", "field_label" "text", "before_value" "jsonb", "after_value" "jsonb", "include_values" boolean DEFAULT true) RETURNS "jsonb"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
declare
  operation text;
  change_entry jsonb;
begin
  operation := case
    when before_value is null and after_value is not null then 'added'
    when before_value is not null and after_value is null then 'removed'
    else 'changed'
  end;

  change_entry := jsonb_build_object(
    'field', field_name,
    'label', field_label,
    'op', operation
  );

  if include_values then
    change_entry := change_entry || jsonb_build_object(
      'before', before_value,
      'after', after_value
    );
  end if;

  return jsonb_strip_nulls(change_entry);
end;
$$;


ALTER FUNCTION "public"."build_event_history_change"("field_name" "text", "field_label" "text", "before_value" "jsonb", "after_value" "jsonb", "include_values" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_access_calendar_workspace_topic"("target_topic" "text") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  with requested_calendar as (
    select public.get_calendar_id_from_workspace_topic(target_topic) as calendar_id
  )
  select exists (
    select 1
    from requested_calendar
    where calendar_id is not null
      and (
        public.is_active_calendar_member(calendar_id)
        or public.is_calendar_publicly_viewable(calendar_id)
      )
  );
$$;


ALTER FUNCTION "public"."can_access_calendar_workspace_topic"("target_topic" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_access_subscription_catalog_topic"("target_topic" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  with parsed as (
    select public.get_catalog_id_from_subscription_topic(target_topic) as catalog_id
  )
  select exists (
    select 1
    from parsed
    join public.calendar_subscription_installs as i
      on i.subscription_catalog_id = parsed.catalog_id
    where parsed.catalog_id is not null
      and public.is_active_calendar_member(i.calendar_id)
  );
$$;


ALTER FUNCTION "public"."can_access_subscription_catalog_topic"("target_topic" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_update_calendar_event"("target_calendar_id" "uuid", "event_creator" "uuid", "locked" boolean) RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    public.has_calendar_role(target_calendar_id, array['manager', 'owner'])
    or (
      public.has_calendar_role(target_calendar_id, array['editor'])
      and (
        locked = false
        or event_creator = auth.uid()
      )
    );
$$;


ALTER FUNCTION "public"."can_update_calendar_event"("target_calendar_id" "uuid", "event_creator" "uuid", "locked" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_calendar_event_category"("target_category_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  current_category public.event_categories;
begin
  select *
  into current_category
  from public.event_categories as categories
  where categories.id = target_category_id
  for update;

  if not found then
    return false;
  end if;

  if not public.has_calendar_role(current_category.calendar_id, array['editor', 'manager', 'owner']) then
    raise exception 'Calendar access denied'
      using errcode = '42501';
  end if;

  update public.events
  set category_id = null,
      updated_at = now(),
      updated_by = coalesce(auth.uid(), updated_by, created_by)
  where category_id = target_category_id;

  delete from public.event_categories as categories
  where categories.id = target_category_id;

  return found;
end;
$$;


ALTER FUNCTION "public"."delete_calendar_event_category"("target_category_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_current_user_account"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  current_user_id uuid;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  delete from auth.users
  where id = current_user_id;
end;
$$;


ALTER FUNCTION "public"."delete_current_user_account"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_owned_calendar"("target_calendar_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  current_user_id uuid;
  current_role public.calendar_role;
  current_status public.calendar_member_status;
  calendar_creator_id uuid;
  owned_calendar_count integer;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  select calendar_members.role, calendar_members.status
  into current_role, current_status
  from public.calendar_members as calendar_members
  where calendar_members.calendar_id = target_calendar_id
    and calendar_members.user_id = current_user_id;

  select calendars.created_by
  into calendar_creator_id
  from public.calendars as calendars
  where calendars.id = target_calendar_id;

  if calendar_creator_id is null then
    raise exception 'Calendar not found'
      using errcode = 'P0002';
  end if;

  if calendar_creator_id <> current_user_id
    and (current_role <> 'owner' or current_status <> 'active') then
    raise exception 'Only active owners can delete this calendar'
      using errcode = '42501';
  end if;

  select count(*)
  into owned_calendar_count
  from public.calendar_members as calendar_members
  join public.calendars as calendars
    on calendars.id = calendar_members.calendar_id
  where calendar_members.user_id = current_user_id
    and calendar_members.role = 'owner'
    and calendar_members.status = 'active'
    and calendars.created_by = current_user_id;

  if owned_calendar_count < 2 then
    raise exception 'You must keep at least one owned calendar'
      using errcode = '42501';
  end if;

  delete from public.calendars
  where id = target_calendar_id;
end;
$$;


ALTER FUNCTION "public"."delete_owned_calendar"("target_calendar_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_calendar_event_by_id"("target_event_id" "uuid") RETURNS TABLE("id" "uuid", "calendar_id" "uuid", "title" "text", "content" "jsonb", "start_at" timestamp with time zone, "end_at" timestamp with time zone, "all_day" boolean, "timezone" "text", "categories" "jsonb", "category_id" "uuid", "category_name" "text", "category_created_by" "uuid", "category_created_at" timestamp with time zone, "category_updated_at" timestamp with time zone, "recurrence" "jsonb", "exceptions" "jsonb", "participants" "jsonb", "is_favorite" boolean, "favorited_at" timestamp with time zone, "status" "public"."calendar_event_status", "created_by" "uuid", "updated_by" "uuid", "is_locked" boolean, "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "creator_name" "text", "creator_email" "text", "creator_avatar_url" "text", "updater_name" "text", "updater_email" "text", "updater_avatar_url" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  resolved_calendar_id uuid;
  include_participants boolean;
begin
  select events.calendar_id
  into resolved_calendar_id
  from public.events as events
  where events.id = target_event_id;

  if not (
    public.is_active_calendar_member(resolved_calendar_id)
    or public.is_calendar_publicly_viewable(resolved_calendar_id)
  ) then
    raise exception 'Calendar access denied'
      using errcode = '42501';
  end if;

  include_participants := public.is_active_calendar_member(resolved_calendar_id);

  return query
  select
    events.id,
    events.calendar_id,
    events.title,
    events.content,
    events.start_at,
    events.end_at,
    events.all_day,
    events.timezone,
    public.get_event_categories_json(events.id, true),
    events.category_id,
    primary_category.name,
    primary_category.created_by,
    primary_category.created_at,
    primary_category.updated_at,
    events.recurrence,
    events.exceptions,
    public.get_event_participants_json(events.id, include_participants),
    coalesce(event_favorites.id is not null, false),
    event_favorites.created_at,
    events.status,
    events.created_by,
    events.updated_by,
    events.is_locked,
    events.created_at,
    events.updated_at,
    nullif(trim(creators.raw_user_meta_data ->> 'name'), '')::text,
    creators.email::text,
    nullif(trim(creators.raw_user_meta_data ->> 'avatar_url'), '')::text,
    nullif(trim(updaters.raw_user_meta_data ->> 'name'), '')::text,
    updaters.email::text,
    nullif(trim(updaters.raw_user_meta_data ->> 'avatar_url'), '')::text
  from public.events as events
  left join public.event_categories as primary_category on primary_category.id = events.category_id
  left join auth.users as creators on creators.id = events.created_by
  left join auth.users as updaters on updaters.id = events.updated_by
  left join public.event_favorites as event_favorites
    on event_favorites.event_id = events.id
    and event_favorites.user_id = auth.uid()
  where events.id = target_event_id;
end;
$$;


ALTER FUNCTION "public"."get_calendar_event_by_id"("target_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_calendar_event_categories"("target_calendar_id" "uuid") RETURNS TABLE("id" "uuid", "calendar_id" "uuid", "name" "text", "options" "jsonb", "created_by" "uuid", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not (
    public.is_active_calendar_member(target_calendar_id)
    or public.is_calendar_publicly_viewable(target_calendar_id)
  ) then
    raise exception 'Calendar access denied'
      using errcode = '42501';
  end if;

  return query
  select
    categories.id,
    categories.calendar_id,
    categories.name,
    categories.options,
    categories.created_by,
    categories.created_at,
    categories.updated_at
  from public.event_categories as categories
  where categories.calendar_id = target_calendar_id
  order by lower(categories.name) asc, categories.created_at asc;
end;
$$;


ALTER FUNCTION "public"."get_calendar_event_categories"("target_calendar_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_calendar_event_history"("target_event_id" "uuid", "history_limit" integer DEFAULT 50, "history_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "calendar_id" "uuid", "event_id" "uuid", "action" "public"."event_history_action", "actor_user_id" "uuid", "actor_role" "public"."calendar_role", "summary" "text", "changes" "jsonb", "occurred_at" timestamp with time zone, "actor_name" "text", "actor_email" "text", "actor_avatar_url" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  resolved_calendar_id uuid;
begin
  select coalesce(
    (
      select events.calendar_id
      from public.events as events
      where events.id = target_event_id
      limit 1
    ),
    (
      select history.calendar_id
      from public.event_history as history
      where history.event_id = target_event_id
      order by history.occurred_at desc
      limit 1
    )
  )
  into resolved_calendar_id;

  if resolved_calendar_id is null then
    return;
  end if;

  if not public.is_active_calendar_member(resolved_calendar_id) then
    raise exception 'Calendar access denied'
      using errcode = '42501';
  end if;

  return query
  select
    history.id,
    history.calendar_id,
    history.event_id,
    history.action,
    history.actor_user_id,
    members.role,
    history.summary,
    history.changes,
    history.occurred_at,
    nullif(trim(users.raw_user_meta_data ->> 'name'), '')::text,
    users.email::text,
    nullif(trim(users.raw_user_meta_data ->> 'avatar_url'), '')::text
  from public.event_history as history
  left join auth.users as users on users.id = history.actor_user_id
  left join public.calendar_members as members
    on members.calendar_id = history.calendar_id
   and members.user_id = history.actor_user_id
   and members.status = 'active'
  where history.calendar_id = resolved_calendar_id
    and history.event_id = target_event_id
  order by history.occurred_at desc, history.id desc
  limit greatest(coalesce(history_limit, 50), 0)
  offset greatest(coalesce(history_offset, 0), 0);
end;
$$;


ALTER FUNCTION "public"."get_calendar_event_history"("target_event_id" "uuid", "history_limit" integer, "history_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_calendar_events_with_authors"("target_calendar_id" "uuid") RETURNS TABLE("id" "uuid", "calendar_id" "uuid", "title" "text", "content" "jsonb", "start_at" timestamp with time zone, "end_at" timestamp with time zone, "all_day" boolean, "timezone" "text", "categories" "jsonb", "category_id" "uuid", "category_name" "text", "category_created_by" "uuid", "category_created_at" timestamp with time zone, "category_updated_at" timestamp with time zone, "recurrence" "jsonb", "exceptions" "jsonb", "participants" "jsonb", "is_favorite" boolean, "favorited_at" timestamp with time zone, "status" "public"."calendar_event_status", "created_by" "uuid", "updated_by" "uuid", "is_locked" boolean, "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "creator_name" "text", "creator_email" "text", "creator_avatar_url" "text", "updater_name" "text", "updater_email" "text", "updater_avatar_url" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  include_participants boolean;
begin
  if not (
    public.is_active_calendar_member(target_calendar_id)
    or public.is_calendar_publicly_viewable(target_calendar_id)
  ) then
    raise exception 'Calendar access denied'
      using errcode = '42501';
  end if;

  include_participants := public.is_active_calendar_member(target_calendar_id);

  return query
  select
    events.id,
    events.calendar_id,
    events.title,
    events.content,
    events.start_at,
    events.end_at,
    events.all_day,
    events.timezone,
    public.get_event_categories_json(events.id, true),
    events.category_id,
    primary_category.name,
    primary_category.created_by,
    primary_category.created_at,
    primary_category.updated_at,
    events.recurrence,
    events.exceptions,
    public.get_event_participants_json(events.id, include_participants),
    coalesce(event_favorites.id is not null, false),
    event_favorites.created_at,
    events.status,
    events.created_by,
    events.updated_by,
    events.is_locked,
    events.created_at,
    events.updated_at,
    nullif(trim(creators.raw_user_meta_data ->> 'name'), '')::text,
    creators.email::text,
    nullif(trim(creators.raw_user_meta_data ->> 'avatar_url'), '')::text,
    nullif(trim(updaters.raw_user_meta_data ->> 'name'), '')::text,
    updaters.email::text,
    nullif(trim(updaters.raw_user_meta_data ->> 'avatar_url'), '')::text
  from public.events as events
  left join public.event_categories as primary_category on primary_category.id = events.category_id
  left join auth.users as creators on creators.id = events.created_by
  left join auth.users as updaters on updaters.id = events.updated_by
  left join public.event_favorites as event_favorites
    on event_favorites.event_id = events.id
    and event_favorites.user_id = auth.uid()
  where events.calendar_id = target_calendar_id
  order by events.start_at asc, events.created_at asc;
end;
$$;


ALTER FUNCTION "public"."get_calendar_events_with_authors"("target_calendar_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_calendar_id_from_workspace_topic"("target_topic" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
declare
  parsed_calendar_id text;
begin
  if split_part(target_topic, ':', 1) <> 'calendar' then
    return null;
  end if;

  if split_part(target_topic, ':', 3) <> 'workspace' then
    return null;
  end if;

  parsed_calendar_id := split_part(target_topic, ':', 2);

  begin
    return parsed_calendar_id::uuid;
  exception
    when others then
      return null;
  end;
end;
$$;


ALTER FUNCTION "public"."get_calendar_id_from_workspace_topic"("target_topic" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_calendar_initial_data"("target_calendar_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  has_access boolean;
  membership_row public.calendar_members;
begin
  has_access := public.is_active_calendar_member(target_calendar_id)
    or public.is_calendar_publicly_viewable(target_calendar_id);

  if auth.uid() is not null then
    select *
    into membership_row
    from public.calendar_members as members
    where members.calendar_id = target_calendar_id
      and members.user_id = auth.uid()
    limit 1;
  end if;

  return jsonb_build_object(
    'calendar',
    case
      when has_access then (
        select jsonb_build_object(
          'id', calendars.id,
          'name', calendars.name,
          'avatarUrl', calendars.avatar_url,
          'accessMode', calendars.access_mode,
          'eventLayout', calendars.event_layout,
          'eventFieldSettings', calendars.event_field_settings,
          'layoutOptions', calendars.layout_options,
          'updatedAt', calendars.updated_at,
          'createdAt', calendars.created_at
        )
        from public.calendars as calendars
        where calendars.id = target_calendar_id
      )
      else null
    end,
    'membership',
    jsonb_build_object(
      'isMember', coalesce(membership_row.status = 'active', false),
      'role', membership_row.role,
      'status', membership_row.status
    ),
    'myCalendars',
    case
      when auth.uid() is null then '[]'::jsonb
      else coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', calendars.id,
              'name', calendars.name,
              'avatarUrl', calendars.avatar_url,
              'accessMode', calendars.access_mode,
              'eventLayout', calendars.event_layout,
              'eventFieldSettings', calendars.event_field_settings,
              'layoutOptions', calendars.layout_options,
              'updatedAt', calendars.updated_at,
              'createdAt', calendars.created_at,
              'role', members.role
            )
            order by calendars.updated_at desc, calendars.created_at asc
          )
          from public.calendars as calendars
          join public.calendar_members as members
            on members.calendar_id = calendars.id
          where members.user_id = auth.uid()
            and members.status = 'active'
        ),
        '[]'::jsonb
      )
    end,
    'eventCategories',
    case
      when has_access then coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', categories.id,
              'calendarId', categories.calendar_id,
              'name', categories.name,
              'options', categories.options,
              'createdById', categories.created_by,
              'createdAt', categories.created_at,
              'updatedAt', categories.updated_at
            )
            order by lower(categories.name) asc, categories.created_at asc
          )
          from public.event_categories as categories
          where categories.calendar_id = target_calendar_id
        ),
        '[]'::jsonb
      )
      else '[]'::jsonb
    end,
    'events',
    case
      when has_access then coalesce(
        (
          select jsonb_agg(to_jsonb(events))
          from public.get_calendar_events_with_authors(target_calendar_id) as events
        ),
        '[]'::jsonb
      )
      else '[]'::jsonb
    end
  );
end;
$$;


ALTER FUNCTION "public"."get_calendar_initial_data"("target_calendar_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_calendar_installed_subscriptions"("target_calendar_id" "uuid") RETURNS TABLE("install_id" "uuid", "subscription_catalog_id" "uuid", "slug" "text", "name" "text", "description" "text", "source_type" "text", "status" "text", "source_deleted_at" timestamp with time zone, "source_deleted_reason" "text", "category_color" "text", "config" "jsonb", "source_calendar_id" "uuid", "source_calendar_name" "text", "provider_name" "text", "is_visible" boolean, "installed_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    installs.id as install_id,
    catalogs.id as subscription_catalog_id,
    catalogs.slug,
    catalogs.name,
    catalogs.description,
    catalogs.source_type,
    catalogs.status,
    catalogs.source_deleted_at,
    catalogs.source_deleted_reason,
    catalogs.category_color,
    catalogs.config,
    catalogs.source_calendar_id,
    calendars.name as source_calendar_name,
    case
      when catalogs.source_type = 'system_holiday' then '캘린버'
      else coalesce(
        nullif(trim(owners.raw_user_meta_data ->> 'name'), ''),
        owners.email,
        '공유 사용자'
      )
    end as provider_name,
    installs.is_visible,
    installs.created_at as installed_at
  from public.calendar_subscription_installs as installs
  join public.calendar_subscription_catalogs as catalogs
    on catalogs.id = installs.subscription_catalog_id
  left join public.calendars as calendars
    on calendars.id = catalogs.source_calendar_id
  left join auth.users as owners
    on owners.id = catalogs.owner_user_id
  where installs.calendar_id = target_calendar_id
    and catalogs.is_active = true
  order by
    (catalogs.status = 'source_deleted') desc,
    installs.created_at asc;
$$;


ALTER FUNCTION "public"."get_calendar_installed_subscriptions"("target_calendar_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_calendar_member_directory"("target_calendar_id" "uuid") RETURNS TABLE("id" "uuid", "user_id" "uuid", "role" "public"."calendar_role", "status" "public"."calendar_member_status", "created_at" timestamp with time zone, "email" "text", "name" "text", "avatar_url" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if public.is_active_calendar_member(target_calendar_id) then
    return query
    select
      calendar_members.id,
      calendar_members.user_id,
      calendar_members.role,
      calendar_members.status,
      calendar_members.created_at,
      users.email::text,
      nullif(trim(users.raw_user_meta_data ->> 'name'), '')::text,
      nullif(trim(users.raw_user_meta_data ->> 'avatar_url'), '')::text
    from public.calendar_members as calendar_members
    join auth.users as users on users.id = calendar_members.user_id
    where calendar_members.calendar_id = target_calendar_id
    order by calendar_members.created_at asc;
    return;
  end if;

  return query
  select
    calendar_members.id,
    calendar_members.user_id,
    calendar_members.role,
    calendar_members.status,
    calendar_members.created_at,
    users.email::text,
    nullif(trim(users.raw_user_meta_data ->> 'name'), '')::text,
    nullif(trim(users.raw_user_meta_data ->> 'avatar_url'), '')::text
  from public.calendar_members as calendar_members
  join auth.users as users on users.id = calendar_members.user_id
  where calendar_members.calendar_id = target_calendar_id
    and calendar_members.user_id = auth.uid()
    and calendar_members.status = 'pending'
  order by calendar_members.created_at asc;
end;
$$;


ALTER FUNCTION "public"."get_calendar_member_directory"("target_calendar_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_calendar_subscription_catalog"("target_calendar_id" "uuid", "search_query" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "slug" "text", "name" "text", "description" "text", "source_type" "text", "visibility" "text", "verified" boolean, "status" "text", "source_deleted_at" timestamp with time zone, "source_deleted_reason" "text", "category_color" "text", "config" "jsonb", "owner_user_id" "uuid", "source_calendar_id" "uuid", "source_calendar_name" "text", "source_category_id" "uuid", "provider_name" "text", "installed" boolean, "is_visible" boolean, "installed_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  with normalized_query as (
    select nullif(trim(search_query), '') as q
  )
  select
    catalogs.id,
    catalogs.slug,
    catalogs.name,
    catalogs.description,
    catalogs.source_type,
    catalogs.visibility,
    catalogs.verified,
    catalogs.status,
    catalogs.source_deleted_at,
    catalogs.source_deleted_reason,
    catalogs.category_color,
    catalogs.config,
    catalogs.owner_user_id,
    catalogs.source_calendar_id,
    calendars.name as source_calendar_name,
    catalogs.source_category_id,
    case
      when catalogs.source_type = 'system_holiday' then '캘린버'
      else coalesce(
        nullif(trim(owners.raw_user_meta_data ->> 'name'), ''),
        owners.email,
        '공유 사용자'
      )
    end as provider_name,
    installs.id is not null as installed,
    coalesce(installs.is_visible, true) as is_visible,
    installs.created_at as installed_at
  from public.calendar_subscription_catalogs as catalogs
  left join public.calendar_subscription_installs as installs
    on installs.subscription_catalog_id = catalogs.id
   and installs.calendar_id = target_calendar_id
  left join public.calendars as calendars
    on calendars.id = catalogs.source_calendar_id
  left join auth.users as owners
    on owners.id = catalogs.owner_user_id
  cross join normalized_query
  where catalogs.is_active = true
    and (
      catalogs.visibility = 'public'
      or catalogs.owner_user_id = auth.uid()
      or (
        catalogs.source_calendar_id is not null
        and public.is_active_calendar_member(catalogs.source_calendar_id)
      )
      or installs.id is not null
    )
    and (
      normalized_query.q is null
      or lower(catalogs.name) like '%' || lower(normalized_query.q) || '%'
      or lower(catalogs.description) like '%' || lower(normalized_query.q) || '%'
      or lower(catalogs.slug) like '%' || lower(normalized_query.q) || '%'
    )
  order by
    installed desc,
    (catalogs.status = 'source_deleted') desc,
    catalogs.verified desc,
    catalogs.created_at desc;
$$;


ALTER FUNCTION "public"."get_calendar_subscription_catalog"("target_calendar_id" "uuid", "search_query" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_calendar_workspace_topic"("target_calendar_id" "uuid") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  select 'calendar:' || target_calendar_id::text || ':workspace';
$$;


ALTER FUNCTION "public"."get_calendar_workspace_topic"("target_calendar_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_catalog_id_from_subscription_topic"("target_topic" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
declare
  prefix text := 'subscription:catalog:';
  raw_id text;
begin
  if not starts_with(target_topic, prefix) then
    return null;
  end if;

  raw_id := substring(target_topic from length(prefix) + 1);

  begin
    return raw_id::uuid;
  exception
    when others then
      return null;
  end;
end;
$$;


ALTER FUNCTION "public"."get_catalog_id_from_subscription_topic"("target_topic" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_collection_publish_status"("target_calendar_id" "uuid") RETURNS TABLE("category_id" "uuid", "catalog_id" "uuid", "is_published" boolean, "visibility" "text", "status" "text", "subscriber_count" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    ec.id as category_id,
    cat.id as catalog_id,
    cat.id is not null and cat.is_active = true and cat.status = 'active' as is_published,
    cat.visibility,
    cat.status,
    coalesce(
      (
        select count(*)
        from public.calendar_subscription_installs as i
        where i.subscription_catalog_id = cat.id
      ),
      0
    ) as subscriber_count
  from public.event_categories as ec
  left join public.calendar_subscription_catalogs as cat
    on cat.source_calendar_id = target_calendar_id
   and cat.source_category_id = ec.id
   and cat.source_type = 'shared_category'
  where ec.calendar_id = target_calendar_id
    and public.has_calendar_role(target_calendar_id, array['manager', 'owner'])
  order by ec.created_at asc;
$$;


ALTER FUNCTION "public"."get_collection_publish_status"("target_calendar_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_default_calendar_event_field_settings"() RETURNS "jsonb"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  select jsonb_build_object(
    'version',
    1,
    'items',
    jsonb_build_array(
      jsonb_build_object('id', 'schedule', 'visible', true),
      jsonb_build_object('id', 'categories', 'visible', true),
      jsonb_build_object('id', 'status', 'visible', false),
      jsonb_build_object('id', 'participants', 'visible', false),
      jsonb_build_object('id', 'recurrence', 'visible', false),
      jsonb_build_object('id', 'exceptions', 'visible', false),
      jsonb_build_object('id', 'timezone', 'visible', false),
      jsonb_build_object('id', 'place', 'visible', false),
      jsonb_build_object('id', 'notification', 'visible', false)
    )
  );
$$;


ALTER FUNCTION "public"."get_default_calendar_event_field_settings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_default_calendar_layout_options"() RETURNS "jsonb"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  select jsonb_build_object(
    'version', 1,
    'weekStartsOn', 'sunday',
    'showWeekendTextColors', true,
    'showHolidayBackground', true,
    'hideWeekendColumns', false
  );
$$;


ALTER FUNCTION "public"."get_default_calendar_layout_options"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_discover_calendars"() RETURNS TABLE("id" "uuid", "name" "text", "avatar_url" "text", "access_mode" "public"."calendar_access_mode", "event_layout" "text", "event_field_settings" "jsonb", "layout_options" "jsonb", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "member_count" bigint, "creator_user_id" "uuid", "creator_name" "text", "creator_email" "text", "creator_avatar_url" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  with active_member_counts as (
    select
      calendar_members.calendar_id,
      count(*)::bigint as member_count
    from public.calendar_members as calendar_members
    where calendar_members.status = 'active'
    group by calendar_members.calendar_id
  )
  select
    calendars.id,
    calendars.name,
    calendars.avatar_url,
    calendars.access_mode,
    calendars.event_layout,
    calendars.event_field_settings,
    calendars.layout_options,
    calendars.updated_at,
    calendars.created_at,
    coalesce(active_member_counts.member_count, 0) as member_count,
    coalesce(created_user.user_id, fallback_owner.user_id) as creator_user_id,
    coalesce(created_user.name, fallback_owner.name) as creator_name,
    coalesce(created_user.email, fallback_owner.email) as creator_email,
    coalesce(created_user.avatar_url, fallback_owner.avatar_url) as creator_avatar_url
  from public.calendars as calendars
  left join active_member_counts
    on active_member_counts.calendar_id = calendars.id
  left join lateral (
    select
      users.id as user_id,
      nullif(trim(users.raw_user_meta_data ->> 'name'), '')::text as name,
      users.email::text as email,
      nullif(trim(users.raw_user_meta_data ->> 'avatar_url'), '')::text as avatar_url
    from auth.users as users
    where users.id = calendars.created_by
    limit 1
  ) as created_user on true
  left join lateral (
    select
      users.id as user_id,
      nullif(trim(users.raw_user_meta_data ->> 'name'), '')::text as name,
      users.email::text as email,
      nullif(trim(users.raw_user_meta_data ->> 'avatar_url'), '')::text as avatar_url
    from public.calendar_members as calendar_members
    join auth.users as users on users.id = calendar_members.user_id
    where calendar_members.calendar_id = calendars.id
      and calendar_members.role = 'owner'
      and calendar_members.status = 'active'
      and not exists (
        select 1
        from auth.users as created_users
        where created_users.id = calendars.created_by
      )
    order by calendar_members.created_at asc
    limit 1
  ) as fallback_owner on true
  where calendars.access_mode in ('public_open', 'public_approval')
  order by
    coalesce(active_member_counts.member_count, 0) desc,
    calendars.created_at asc,
    calendars.updated_at desc;
$$;


ALTER FUNCTION "public"."get_discover_calendars"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_event_categories_json"("target_event_id" "uuid", "include_details" boolean DEFAULT true) RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select case
    when include_details is not true then '[]'::jsonb
    else coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', categories.id,
            'calendarId', categories.calendar_id,
            'name', categories.name,
            'options', categories.options,
            'createdById', categories.created_by,
            'createdAt', extract(epoch from categories.created_at) * 1000,
            'updatedAt', extract(epoch from categories.updated_at) * 1000
          )
          order by assignments.created_at asc, assignments.id asc
        )
        from public.event_category_assignments as assignments
        join public.event_categories as categories on categories.id = assignments.category_id
        where assignments.event_id = target_event_id
      ),
      '[]'::jsonb
    )
  end;
$$;


ALTER FUNCTION "public"."get_event_categories_json"("target_event_id" "uuid", "include_details" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_event_participants_json"("target_event_id" "uuid", "include_details" boolean DEFAULT true) RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select case
    when include_details is not true then '[]'::jsonb
    else coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', participants.id,
            'eventId', participants.event_id,
            'userId', participants.user_id,
            'role', participants.role,
            'createdAt', extract(epoch from participants.created_at) * 1000,
            'user', jsonb_build_object(
              'id', participants.user_id,
              'name', nullif(trim(users.raw_user_meta_data ->> 'name'), '')::text,
              'email', users.email::text,
              'avatarUrl', nullif(trim(users.raw_user_meta_data ->> 'avatar_url'), '')::text
            )
          )
          order by participants.created_at asc, participants.id asc
        )
        from public.event_participants as participants
        join auth.users as users on users.id = participants.user_id
        where participants.event_id = target_event_id
      ),
      '[]'::jsonb
    )
  end;
$$;


ALTER FUNCTION "public"."get_event_participants_json"("target_event_id" "uuid", "include_details" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_favorite_calendar_events"("target_calendar_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "calendar_id" "uuid", "title" "text", "content" "jsonb", "start_at" timestamp with time zone, "end_at" timestamp with time zone, "all_day" boolean, "timezone" "text", "categories" "jsonb", "category_id" "uuid", "category_name" "text", "category_created_by" "uuid", "category_created_at" timestamp with time zone, "category_updated_at" timestamp with time zone, "recurrence" "jsonb", "exceptions" "jsonb", "participants" "jsonb", "is_favorite" boolean, "favorited_at" timestamp with time zone, "status" "public"."calendar_event_status", "created_by" "uuid", "updated_by" "uuid", "is_locked" boolean, "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "creator_name" "text", "creator_email" "text", "creator_avatar_url" "text", "updater_name" "text", "updater_email" "text", "updater_avatar_url" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if target_calendar_id is not null
    and not public.is_active_calendar_member(target_calendar_id) then
    raise exception 'Calendar access denied'
      using errcode = '42501';
  end if;

  return query
  select
    events.id,
    events.calendar_id,
    events.title,
    events.content,
    events.start_at,
    events.end_at,
    events.all_day,
    events.timezone,
    public.get_event_categories_json(events.id, true),
    events.category_id,
    primary_category.name,
    primary_category.created_by,
    primary_category.created_at,
    primary_category.updated_at,
    events.recurrence,
    events.exceptions,
    public.get_event_participants_json(events.id, true),
    true,
    favorites.created_at,
    events.status,
    events.created_by,
    events.updated_by,
    events.is_locked,
    events.created_at,
    events.updated_at,
    nullif(trim(creators.raw_user_meta_data ->> 'name'), '')::text,
    creators.email::text,
    nullif(trim(creators.raw_user_meta_data ->> 'avatar_url'), '')::text,
    nullif(trim(updaters.raw_user_meta_data ->> 'name'), '')::text,
    updaters.email::text,
    nullif(trim(updaters.raw_user_meta_data ->> 'avatar_url'), '')::text
  from public.event_favorites as favorites
  join public.events as events on events.id = favorites.event_id
  left join public.event_categories as primary_category on primary_category.id = events.category_id
  left join auth.users as creators on creators.id = events.created_by
  left join auth.users as updaters on updaters.id = events.updated_by
  where favorites.user_id = auth.uid()
    and (target_calendar_id is null or events.calendar_id = target_calendar_id)
    and exists (
      select
        1
      from
        public.calendar_members as members
      where
        members.calendar_id = events.calendar_id
        and members.user_id = auth.uid()
        and members.status = 'active'
    )
  order by favorites.created_at desc, events.start_at asc nulls last, events.created_at asc;
end;
$$;


ALTER FUNCTION "public"."get_favorite_calendar_events"("target_calendar_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_shared_collection_subscription_events"("p_catalog_id" "uuid", "p_calendar_id" "uuid", "p_range_start" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_range_end" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("id" "uuid", "title" "text", "content" "jsonb", "start_at" timestamp with time zone, "end_at" timestamp with time zone, "all_day" boolean, "timezone" "text", "status" "text", "recurrence" "jsonb", "exceptions" "text"[], "category_id" "uuid", "category_name" "text", "category_color" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_source_calendar_id uuid;
  v_source_category_id uuid;
begin
  -- 설치 여부 확인: 호출자의 캘린더에 이 구독이 설치되어 있어야 함
  if not exists (
    select 1
    from public.calendar_subscription_installs as i
    where i.subscription_catalog_id = p_catalog_id
      and i.calendar_id = p_calendar_id
      and public.is_active_calendar_member(p_calendar_id)
  ) then
    raise exception 'permission_denied: subscription not installed';
  end if;

  -- 원본 캘린더/카테고리 조회
  select source_calendar_id, source_category_id
  into v_source_calendar_id, v_source_category_id
  from public.calendar_subscription_catalogs
  where id = p_catalog_id
    and source_type = 'shared_category'
    and is_active = true
    and status = 'active';

  if v_source_calendar_id is null or v_source_category_id is null then
    return;
  end if;

  -- 원본 이벤트 반환 (날짜 범위 필터 선택적)
  return query
  select
    e.id,
    e.title,
    e.content,
    e.start_at,
    e.end_at,
    e.all_day,
    e.timezone,
    e.status,
    e.recurrence,
    e.exceptions,
    ec.id as category_id,
    ec.name as category_name,
    coalesce(ec.options ->> 'color', 'gray') as category_color
  from public.events as e
  left join public.event_categories as ec
    on ec.id = e.category_id
  where e.calendar_id = v_source_calendar_id
    and e.category_id = v_source_category_id
    and (p_range_start is null or e.end_at >= p_range_start)
    and (p_range_end   is null or e.start_at <= p_range_end)
  order by e.start_at asc;
end;
$$;


ALTER FUNCTION "public"."get_shared_collection_subscription_events"("p_catalog_id" "uuid", "p_calendar_id" "uuid", "p_range_start" timestamp with time zone, "p_range_end" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  new_calendar_id uuid;
  display_name text;
  default_calendar_name text;
begin
  display_name := nullif(trim(new.raw_user_meta_data ->> 'name'), '');
  default_calendar_name := coalesce(
    concat(display_name, '의 캘린더'),
    '내 캘린더'
  );

  insert into public.profiles (user_id)
  values (new.id);

  insert into public.calendars (name, created_by)
  values (default_calendar_name, new.id)
  returning id into new_calendar_id;

  insert into public.calendar_members (user_id, calendar_id, role)
  values (new.id, new_calendar_id, 'owner');

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_calendar_role"("target_calendar_id" "uuid", "allowed_roles" "text"[]) RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1
    from public.calendar_members
    where calendar_id = target_calendar_id
      and user_id = auth.uid()
      and status = 'active'
      and role::text = any(allowed_roles)
  );
$$;


ALTER FUNCTION "public"."has_calendar_role"("target_calendar_id" "uuid", "allowed_roles" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_active_calendar_member"("target_calendar_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1
    from public.calendar_members
    where calendar_id = target_calendar_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;


ALTER FUNCTION "public"."is_active_calendar_member"("target_calendar_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_calendar_member"("target_calendar_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1
    from public.calendar_members
    where calendar_id = target_calendar_id
      and user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_calendar_member"("target_calendar_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_calendar_publicly_viewable"("target_calendar_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1
    from public.calendars
    where id = target_calendar_id
      and access_mode in ('public_open', 'public_approval')
  );
$$;


ALTER FUNCTION "public"."is_calendar_publicly_viewable"("target_calendar_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_calendar_workspace_topic_private"("target_calendar_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select not public.is_calendar_publicly_viewable(target_calendar_id);
$$;


ALTER FUNCTION "public"."is_calendar_workspace_topic_private"("target_calendar_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_valid_calendar_event_field_settings"("target" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
declare
  item jsonb;
  field_id text;
  seen_ids text[] := array[]::text[];
begin
  if target is null or jsonb_typeof(target) <> 'object' then
    return false;
  end if;

  if coalesce((target ->> 'version')::integer, 0) <> 1 then
    return false;
  end if;

  if jsonb_typeof(target -> 'items') <> 'array' then
    return false;
  end if;

  for item in
    select value
    from jsonb_array_elements(target -> 'items')
  loop
    if jsonb_typeof(item) <> 'object' then
      return false;
    end if;

    if jsonb_typeof(item -> 'id') <> 'string' then
      return false;
    end if;

    if jsonb_typeof(item -> 'visible') <> 'boolean' then
      return false;
    end if;

    field_id := item ->> 'id';

    if field_id not in (
      'schedule',
      'categories',
      'status',
      'participants',
      'recurrence',
      'exceptions',
      'timezone',
      'place',
      'notification'
    ) then
      return false;
    end if;

    if field_id = any(seen_ids) then
      return false;
    end if;

    seen_ids := array_append(seen_ids, field_id);
  end loop;

  return true;
exception
  when others then
    return false;
end;
$$;


ALTER FUNCTION "public"."is_valid_calendar_event_field_settings"("target" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_valid_calendar_layout_options"("target" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
begin
  if target is null or jsonb_typeof(target) <> 'object' then
    return false;
  end if;

  if coalesce((target ->> 'version')::integer, 0) <> 1 then
    return false;
  end if;

  if (target ->> 'weekStartsOn') not in ('sunday', 'monday') then
    return false;
  end if;

  if jsonb_typeof(target -> 'showWeekendTextColors') <> 'boolean' then
    return false;
  end if;

  if jsonb_typeof(target -> 'showHolidayBackground') <> 'boolean' then
    return false;
  end if;

  if jsonb_typeof(target -> 'hideWeekendColumns') <> 'boolean' then
    return false;
  end if;

  return true;
exception
  when others then
    return false;
end;
$$;


ALTER FUNCTION "public"."is_valid_calendar_layout_options"("target" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_valid_event_category_color"("target" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  select coalesce(target = any (array[
    'blue',
    'green',
    'sky',
    'purple',
    'red',
    'orange',
    'yellow',
    'gray',
    'olive',
    'pink',
    'brown'
  ]), false);
$$;


ALTER FUNCTION "public"."is_valid_event_category_color"("target" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_valid_event_category_options"("target" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
begin
  if target is null then
    return false;
  end if;

  if jsonb_typeof(target) <> 'object' then
    return false;
  end if;

  if jsonb_typeof(target -> 'visibleByDefault') <> 'boolean' then
    return false;
  end if;

  if jsonb_typeof(target -> 'color') <> 'string' then
    return false;
  end if;

  if not public.is_valid_event_category_color(target ->> 'color') then
    return false;
  end if;

  return true;
exception
  when others then
    return false;
end;
$$;


ALTER FUNCTION "public"."is_valid_event_category_options"("target" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."join_public_calendar"("target_calendar_id" "uuid") RETURNS TABLE("role" "public"."calendar_role", "status" "public"."calendar_member_status")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  current_user_id uuid;
  target_access_mode public.calendar_access_mode;
  existing_role public.calendar_role;
  existing_status public.calendar_member_status;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  select calendars.access_mode
  into target_access_mode
  from public.calendars as calendars
  where calendars.id = target_calendar_id;

  if target_access_mode is null then
    raise exception 'Calendar not found'
      using errcode = 'P0002';
  end if;

  if target_access_mode = 'private' then
    raise exception 'Private calendars require an invite'
      using errcode = '42501';
  end if;

  select calendar_members.role, calendar_members.status
  into existing_role, existing_status
  from public.calendar_members as calendar_members
  where calendar_members.calendar_id = target_calendar_id
    and calendar_members.user_id = current_user_id;

  if existing_status is not null then
    return query
    select existing_role, existing_status;
    return;
  end if;

  return query
  insert into public.calendar_members (user_id, calendar_id, role, status)
  values (
    current_user_id,
    target_calendar_id,
    'editor',
    case
      when target_access_mode = 'public_open' then 'active'::public.calendar_member_status
      else 'pending'::public.calendar_member_status
    end
  )
  returning calendar_members.role, calendar_members.status;
end;
$$;


ALTER FUNCTION "public"."join_public_calendar"("target_calendar_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."leave_calendar"("target_calendar_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  current_user_id uuid;
  current_role public.calendar_role;
  current_status public.calendar_member_status;
  active_owner_count integer;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  select calendar_members.role, calendar_members.status
  into current_role, current_status
  from public.calendar_members as calendar_members
  where calendar_members.calendar_id = target_calendar_id
    and calendar_members.user_id = current_user_id;

  if current_status is null or current_status <> 'active' then
    raise exception 'Active membership required'
      using errcode = '42501';
  end if;

  if current_role = 'owner' then
    select count(*)
    into active_owner_count
    from public.calendar_members as calendar_members
    where calendar_members.calendar_id = target_calendar_id
      and calendar_members.role = 'owner'
      and calendar_members.status = 'active';

    if active_owner_count < 2 then
      raise exception 'The last owner cannot leave the calendar'
        using errcode = '42501';
    end if;
  end if;

  delete from public.calendar_members
  where calendar_id = target_calendar_id
    and user_id = current_user_id;
end;
$$;


ALTER FUNCTION "public"."leave_calendar"("target_calendar_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_calendar_event_history"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  target_action public.event_history_action;
  target_changes jsonb;
  target_summary text;
  target_calendar_id uuid := coalesce(new.calendar_id, old.calendar_id);
  target_event_id uuid := coalesce(new.id, old.id);
  actor_id uuid;
begin
  if tg_op = 'DELETE' then
    return null;
  end if;

  target_action := case tg_op
    when 'INSERT' then 'created'::public.event_history_action
    when 'UPDATE' then 'updated'::public.event_history_action
    else null
  end;

  target_changes := public.build_calendar_event_history_changes(old, new, tg_op);

  if tg_op = 'UPDATE' and jsonb_array_length(target_changes) = 0 then
    return null;
  end if;

  target_summary := public.build_calendar_event_history_summary(
    target_action,
    target_changes
  );

  actor_id := coalesce(
    auth.uid(),
    new.updated_by,
    new.created_by
  );

  insert into public.event_history (
    calendar_id,
    event_id,
    action,
    actor_user_id,
    summary,
    changes,
    occurred_at
  )
  values (
    target_calendar_id,
    target_event_id,
    target_action,
    actor_id,
    target_summary,
    target_changes,
    now()
  );

  return null;
end;
$$;


ALTER FUNCTION "public"."log_calendar_event_history"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_subscription_catalog_source_deleted"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if (
    old.source_type in ('shared_category', 'shared_calendar')
    and (
      (old.source_calendar_id is not null and new.source_calendar_id is null)
      or (old.source_type = 'shared_category' and old.source_category_id is not null and new.source_category_id is null)
    )
  ) then
    new.status := 'source_deleted';
    new.source_deleted_at := coalesce(new.source_deleted_at, now());
    new.source_deleted_reason := coalesce(
      new.source_deleted_reason,
      case
        when old.source_type = 'shared_category' then 'source_category_deleted'
        else 'source_calendar_deleted'
      end
    );
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."mark_subscription_catalog_source_deleted"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."publish_collection_as_subscription"("target_calendar_id" "uuid", "target_category_id" "uuid", "p_name" "text", "p_description" "text" DEFAULT ''::"text", "p_visibility" "text" DEFAULT 'public'::"text") RETURNS TABLE("catalog_id" "uuid", "slug" "text", "created" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_caller_id    uuid := auth.uid();
  v_slug         text;
  v_catalog_id   uuid;
  v_color        text;
  v_created      boolean := false;
begin
  -- 권한 확인: manager 또는 owner만 공유 가능
  if not public.has_calendar_role(target_calendar_id, array['manager', 'owner']) then
    raise exception 'permission_denied: manager or owner role required';
  end if;

  -- 카테고리가 해당 캘린더에 속하는지 확인
  if not exists (
    select 1 from public.event_categories
    where id = target_category_id
      and calendar_id = target_calendar_id
  ) then
    raise exception 'not_found: category does not belong to calendar';
  end if;

  -- 카테고리 색상 조회
  select coalesce(
    (ec.options ->> 'color'),
    'gray'
  ) into v_color
  from public.event_categories as ec
  where ec.id = target_category_id;

  -- 슬러그 생성: subscription.shared.<calendar_id>.<category_id>
  v_slug := 'subscription.shared.' || target_calendar_id::text || '.' || target_category_id::text;

  -- 기존 카탈로그 확인 (같은 source_category_id로 이미 발행된 것)
  select id into v_catalog_id
  from public.calendar_subscription_catalogs
  where source_calendar_id = target_calendar_id
    and source_category_id = target_category_id
  limit 1;

  if v_catalog_id is not null then
    -- 기존 카탈로그 업데이트 (재활성화 포함)
    update public.calendar_subscription_catalogs
    set
      name = p_name,
      description = p_description,
      visibility = p_visibility,
      category_color = v_color,
      status = 'active',
      source_deleted_at = null,
      source_deleted_reason = null,
      is_active = true,
      updated_at = now()
    where id = v_catalog_id;

    return query select v_catalog_id, v_slug, false;
    return;
  end if;

  -- 새 카탈로그 생성
  insert into public.calendar_subscription_catalogs (
    slug,
    name,
    description,
    source_type,
    visibility,
    verified,
    category_color,
    config,
    owner_user_id,
    source_calendar_id,
    source_category_id,
    created_by
  ) values (
    v_slug,
    p_name,
    p_description,
    'shared_category',
    p_visibility,
    false,
    v_color,
    jsonb_build_object(
      'source_calendar_id', target_calendar_id,
      'source_category_id', target_category_id
    ),
    v_caller_id,
    target_calendar_id,
    target_category_id,
    v_caller_id
  )
  returning id into v_catalog_id;

  v_created := true;

  return query select v_catalog_id, v_slug, true;
end;
$$;


ALTER FUNCTION "public"."publish_collection_as_subscription"("target_calendar_id" "uuid", "target_category_id" "uuid", "p_name" "text", "p_description" "text", "p_visibility" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."random_event_category_color"() RETURNS "text"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
  select (
    array[
      'blue',
      'green',
      'sky',
      'purple',
      'red',
      'orange',
      'yellow',
      'gray',
      'olive',
      'pink',
      'brown'
    ]
  )[1 + floor(random() * 11)::int];
$$;


ALTER FUNCTION "public"."random_event_category_color"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_calendar_member"("target_member_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  actor_user_id uuid;
  actor_membership public.calendar_members%rowtype;
  target_membership public.calendar_members%rowtype;
  active_owner_count integer;
begin
  actor_user_id := auth.uid();

  if actor_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  select *
  into target_membership
  from public.calendar_members
  where id = target_member_id;

  if target_membership.id is null then
    raise exception 'Member not found'
      using errcode = 'P0002';
  end if;

  select *
  into actor_membership
  from public.calendar_members
  where calendar_id = target_membership.calendar_id
    and user_id = actor_user_id;

  if actor_membership.id is null
     or actor_membership.status <> 'active'
     or actor_membership.role not in ('manager', 'owner') then
    raise exception 'Only active managers or owners can remove members'
      using errcode = '42501';
  end if;

  if target_membership.user_id = actor_user_id then
    raise exception 'Use leave flow to remove your own membership'
      using errcode = '42501';
  end if;

  if actor_membership.role = 'manager'
     and target_membership.role not in ('viewer', 'editor') then
    raise exception 'Managers can remove only viewers or editors'
      using errcode = '42501';
  end if;

  if target_membership.role = 'owner'
     and target_membership.status = 'active' then
    select count(*)
    into active_owner_count
    from public.calendar_members
    where calendar_id = target_membership.calendar_id
      and role = 'owner'
      and status = 'active';

    if active_owner_count < 2 then
      raise exception 'The last owner cannot be removed'
        using errcode = '42501';
    end if;
  end if;

  delete from public.calendar_members
  where id = target_membership.id;
end;
$$;


ALTER FUNCTION "public"."remove_calendar_member"("target_member_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."replace_calendar_event_categories"("target_event_id" "uuid", "target_category_ids" "uuid"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  current_event public.events;
  normalized_category_ids uuid[] := coalesce(target_category_ids, array[]::uuid[]);
  previous_categories jsonb := '[]'::jsonb;
  next_categories jsonb := '[]'::jsonb;
  next_primary_category_id uuid;
begin
  select *
  into current_event
  from public.events as events
  where events.id = target_event_id
  for update;

  if not found then
    raise exception 'Event not found'
      using errcode = 'P0002';
  end if;

  if not public.can_update_calendar_event(
    current_event.calendar_id,
    current_event.created_by,
    current_event.is_locked
  ) then
    raise exception 'Calendar access denied'
      using errcode = '42501';
  end if;

  normalized_category_ids := array(
    select category_id
    from (
      select distinct on (category_id)
        category_id,
        ordinality
      from unnest(normalized_category_ids) with ordinality as input(category_id, ordinality)
      where category_id is not null
      order by category_id, ordinality
    ) as deduped
    order by deduped.ordinality
  );

  if exists (
    select 1
    from unnest(normalized_category_ids) as category_id
    where not exists (
      select 1
      from public.event_categories as categories
      where categories.id = category_id
        and categories.calendar_id = current_event.calendar_id
    )
  ) then
    raise exception 'All event categories must belong to the same calendar'
      using errcode = '23514';
  end if;

  previous_categories := public.get_event_categories_json(target_event_id, true);

  delete from public.event_category_assignments as assignments
  where assignments.event_id = target_event_id
    and not (assignments.category_id = any(normalized_category_ids));

  insert into public.event_category_assignments (
    event_id,
    category_id,
    created_by
  )
  select
    target_event_id,
    category_id,
    auth.uid()
  from unnest(normalized_category_ids) as category_id
  on conflict (event_id, category_id)
  do nothing;

  next_primary_category_id := normalized_category_ids[1];

  update public.events
  set category_id = next_primary_category_id,
      updated_at = now(),
      updated_by = coalesce(auth.uid(), updated_by, created_by)
  where id = target_event_id;

  next_categories := public.get_event_categories_json(target_event_id, true);

  if previous_categories is distinct from next_categories then
    insert into public.event_history (
      calendar_id,
      event_id,
      action,
      actor_user_id,
      summary,
      changes,
      occurred_at
    )
    values (
      current_event.calendar_id,
      target_event_id,
      'updated',
      auth.uid(),
      '카테고리를 변경했습니다.',
      jsonb_build_array(
        public.build_event_history_change(
          'categories',
          '카테고리',
          previous_categories,
          next_categories
        )
      ),
      now()
    );
  end if;

  return public.build_calendar_event_realtime_record(target_event_id);
end;
$$;


ALTER FUNCTION "public"."replace_calendar_event_categories"("target_event_id" "uuid", "target_category_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."replace_calendar_event_participants"("target_event_id" "uuid", "target_user_ids" "uuid"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  current_event public.events;
  normalized_user_ids uuid[] := coalesce(target_user_ids, array[]::uuid[]);
  previous_participants jsonb := '[]'::jsonb;
  next_participants jsonb := '[]'::jsonb;
begin
  select *
  into current_event
  from public.events as events
  where events.id = target_event_id
  for update;

  if not found then
    raise exception 'Event not found'
      using errcode = 'P0002';
  end if;

  if not public.can_update_calendar_event(
    current_event.calendar_id,
    current_event.created_by,
    current_event.is_locked
  ) then
    raise exception 'Calendar access denied'
      using errcode = '42501';
  end if;

  normalized_user_ids := array(
    select distinct user_id
    from unnest(normalized_user_ids) as user_id
    where user_id is not null
  );

  if exists (
    select 1
    from unnest(normalized_user_ids) as user_id
    where not exists (
      select 1
      from public.calendar_members as members
      where members.calendar_id = current_event.calendar_id
        and members.user_id = user_id
        and members.status = 'active'
    )
  ) then
    raise exception 'All event participants must be active calendar members'
      using errcode = '23514';
  end if;

  previous_participants := public.get_event_participants_json(target_event_id, true);

  delete from public.event_participants as participants
  where participants.event_id = target_event_id
    and not (participants.user_id = any(normalized_user_ids));

  insert into public.event_participants (
    event_id,
    user_id,
    role,
    added_by
  )
  select
    target_event_id,
    user_id,
    'participant',
    auth.uid()
  from unnest(normalized_user_ids) as user_id
  on conflict (event_id, user_id)
  do nothing;

  update public.events
  set updated_at = now(),
      updated_by = coalesce(auth.uid(), updated_by, created_by)
  where id = target_event_id;

  next_participants := public.get_event_participants_json(target_event_id, true);

  if previous_participants is distinct from next_participants then
    insert into public.event_history (
      calendar_id,
      event_id,
      action,
      actor_user_id,
      summary,
      changes,
      occurred_at
    )
    values (
      current_event.calendar_id,
      target_event_id,
      'updated',
      auth.uid(),
      '참가자를 변경했습니다.',
      jsonb_build_array(
        public.build_event_history_change(
          'participants',
          '참가자',
          previous_participants,
          next_participants
        )
      ),
      now()
    );
  end if;

  return public.build_calendar_event_realtime_record(target_event_id);
end;
$$;


ALTER FUNCTION "public"."replace_calendar_event_participants"("target_event_id" "uuid", "target_user_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_calendar_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_calendar_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_event_category_assignment_write_metadata"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if tg_op = 'INSERT' then
    new.created_at = coalesce(new.created_at, now());
    new.created_by = coalesce(new.created_by, auth.uid());
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."set_event_category_assignment_write_metadata"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_event_category_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if tg_op = 'INSERT' then
    new.created_at = coalesce(new.created_at, now());
    new.updated_at = coalesce(new.updated_at, new.created_at, now());
    new.created_by = coalesce(new.created_by, auth.uid());
    return new;
  end if;

  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_event_category_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_event_favorite_write_metadata"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if tg_op = 'INSERT' then
    new.created_at = coalesce(new.created_at, now());
    new.user_id = coalesce(new.user_id, auth.uid());
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."set_event_favorite_write_metadata"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_event_participant_write_metadata"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if tg_op = 'INSERT' then
    new.created_at = coalesce(new.created_at, now());
    new.added_by = coalesce(new.added_by, auth.uid());
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."set_event_participant_write_metadata"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_event_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_event_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_event_write_metadata"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if tg_op = 'INSERT' then
    new.created_by = coalesce(new.created_by, auth.uid());
    new.created_at = coalesce(new.created_at, now());
    new.updated_at = coalesce(new.updated_at, new.created_at, now());
    new.updated_by = coalesce(auth.uid(), new.updated_by, new.created_by);
    return new;
  end if;

  new.updated_at = now();
  new.updated_by = coalesce(
    auth.uid(),
    new.updated_by,
    old.updated_by,
    old.created_by,
    new.created_by
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."set_event_write_metadata"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_calendar_subscription_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_calendar_subscription_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."unpublish_collection_subscription"("target_calendar_id" "uuid", "target_category_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_catalog_id uuid;
begin
  if not public.has_calendar_role(target_calendar_id, array['manager', 'owner']) then
    raise exception 'permission_denied: manager or owner role required';
  end if;

  select id into v_catalog_id
  from public.calendar_subscription_catalogs
  where source_calendar_id = target_calendar_id
    and source_category_id = target_category_id
    and is_active = true
  limit 1;

  if v_catalog_id is null then
    return false;
  end if;

  update public.calendar_subscription_catalogs
  set
    status = 'archived',
    is_active = false,
    updated_at = now()
  where id = v_catalog_id;

  return true;
end;
$$;


ALTER FUNCTION "public"."unpublish_collection_subscription"("target_calendar_id" "uuid", "target_category_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_calendar_event_with_conflict_resolution"("target_event_id" "uuid", "expected_updated_at" timestamp with time zone, "patch" "jsonb", "changed_fields" "text"[]) RETURNS TABLE("status" "text", "conflicting_fields" "text"[], "record" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  current_event public.events;
  remote_changed_fields text[] := array[]::text[];
  overlapping_fields text[] := array[]::text[];
begin
  select *
  into current_event
  from public.events as events
  where events.id = target_event_id
  for update;

  if not found then
    return query
    select
      'not_found'::text,
      array[]::text[],
      null::jsonb;
    return;
  end if;

  if not public.can_update_calendar_event(
    current_event.calendar_id,
    current_event.created_by,
    current_event.is_locked
  ) then
    raise exception 'Calendar access denied'
      using errcode = '42501';
  end if;

  if current_event.updated_at is distinct from expected_updated_at then
    select coalesce(
      array_agg(distinct field_name),
      array[]::text[]
    )
    into remote_changed_fields
    from (
      select change_entry ->> 'field' as field_name
      from public.event_history as history
      cross join lateral jsonb_array_elements(history.changes) as change_entry
      where history.event_id = target_event_id
        and history.action = 'updated'
        and history.occurred_at > expected_updated_at
        and history.actor_user_id is distinct from auth.uid()
        and change_entry ? 'field'
    ) as changed;

    select coalesce(
      array_agg(distinct field_name),
      array[]::text[]
    )
    into overlapping_fields
    from (
      select unnest(coalesce(changed_fields, array[]::text[])) as field_name
      intersect
      select unnest(remote_changed_fields) as field_name
    ) as overlapping;

    if coalesce(array_length(overlapping_fields, 1), 0) > 0 then
      return query
      select
        'conflict'::text,
        overlapping_fields,
        public.build_calendar_event_realtime_record(target_event_id);
      return;
    end if;
  end if;

  update public.events as events
  set
    title = case
      when patch ? 'title' then patch ->> 'title'
      else events.title
    end,
    content = case
      when patch ? 'content' then patch -> 'content'
      else events.content
    end,
    start_at = case
      when patch ? 'start_at' then (patch ->> 'start_at')::timestamptz
      else events.start_at
    end,
    end_at = case
      when patch ? 'end_at' then (patch ->> 'end_at')::timestamptz
      else events.end_at
    end,
    all_day = case
      when patch ? 'all_day' then (patch ->> 'all_day')::boolean
      else events.all_day
    end,
    timezone = case
      when patch ? 'timezone' then nullif(patch ->> 'timezone', '')
      else events.timezone
    end,
    category_id = case
      when patch ? 'category_id' then (patch ->> 'category_id')::uuid
      else events.category_id
    end,
    recurrence = case
      when patch ? 'recurrence' then case
        when patch -> 'recurrence' = 'null'::jsonb then null
        else patch -> 'recurrence'
      end
      else events.recurrence
    end,
    exceptions = case
      when patch ? 'exceptions' then patch -> 'exceptions'
      else events.exceptions
    end,
    status = case
      when patch ? 'status' then (patch ->> 'status')::public.calendar_event_status
      else events.status
    end,
    is_locked = case
      when patch ? 'is_locked' then (patch ->> 'is_locked')::boolean
      else events.is_locked
    end
  where events.id = target_event_id;

  return query
  select
    case
      when current_event.updated_at is distinct from expected_updated_at then 'merged'
      else 'updated'
    end::text,
    array[]::text[],
    public.build_calendar_event_realtime_record(target_event_id);
end;
$$;


ALTER FUNCTION "public"."update_calendar_event_with_conflict_resolution"("target_event_id" "uuid", "expected_updated_at" timestamp with time zone, "patch" "jsonb", "changed_fields" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_calendar_event_category"("target_calendar_id" "uuid", "target_name" "text", "target_options" "jsonb" DEFAULT NULL::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  trimmed_name text;
  normalized_options jsonb := jsonb_build_object(
    'visibleByDefault',
    true,
    'color',
    public.random_event_category_color()
  );
  result_id uuid;
begin
  if not public.has_calendar_role(target_calendar_id, array['editor', 'manager', 'owner']) then
    raise exception 'Calendar access denied'
      using errcode = '42501';
  end if;

  trimmed_name := nullif(trim(target_name), '');

  if trimmed_name is null then
    raise exception 'Category name is required'
      using errcode = '23514';
  end if;

  if target_options is not null then
    normalized_options := normalized_options || target_options;

    if not public.is_valid_event_category_options(normalized_options) then
      raise exception 'Invalid category options'
        using errcode = '23514';
    end if;
  end if;

  insert into public.event_categories (
    calendar_id,
    name,
    options,
    created_by
  )
  values (
    target_calendar_id,
    trimmed_name,
    normalized_options,
    auth.uid()
  )
  on conflict (calendar_id, (lower(name)))
  do update
    set name = excluded.name,
        options = case
          when target_options is null then public.event_categories.options
          else excluded.options
        end,
        updated_at = now()
  returning id into result_id;

  return result_id;
end;
$$;


ALTER FUNCTION "public"."upsert_calendar_event_category"("target_calendar_id" "uuid", "target_name" "text", "target_options" "jsonb") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."calendar_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "calendar_id" "uuid",
    "role" "public"."calendar_role" DEFAULT 'owner'::"public"."calendar_role",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "status" "public"."calendar_member_status" DEFAULT 'active'::"public"."calendar_member_status" NOT NULL
);


ALTER TABLE "public"."calendar_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."calendar_subscription_catalogs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "source_type" "text" NOT NULL,
    "visibility" "text" DEFAULT 'public'::"text" NOT NULL,
    "verified" boolean DEFAULT false NOT NULL,
    "category_color" "text",
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "owner_user_id" "uuid",
    "source_calendar_id" "uuid",
    "source_category_id" "uuid",
    "created_by" "uuid",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "source_deleted_at" timestamp with time zone,
    "source_deleted_reason" "text",
    CONSTRAINT "calendar_subscription_catalogs_source_consistency_check" CHECK (((("source_type" = 'system_holiday'::"text") AND ("source_calendar_id" IS NULL) AND ("source_category_id" IS NULL)) OR (("source_type" = 'shared_category'::"text") AND ("source_calendar_id" IS NOT NULL) AND ("source_category_id" IS NOT NULL)) OR ("source_type" = ANY (ARRAY['shared_calendar'::"text", 'custom'::"text"])))),
    CONSTRAINT "calendar_subscription_catalogs_source_type_check" CHECK (("source_type" = ANY (ARRAY['system_holiday'::"text", 'shared_category'::"text", 'shared_calendar'::"text", 'custom'::"text"]))),
    CONSTRAINT "calendar_subscription_catalogs_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'source_deleted'::"text", 'archived'::"text"]))),
    CONSTRAINT "calendar_subscription_catalogs_visibility_check" CHECK (("visibility" = ANY (ARRAY['public'::"text", 'unlisted'::"text", 'private'::"text"])))
);


ALTER TABLE "public"."calendar_subscription_catalogs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."calendar_subscription_installs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "calendar_id" "uuid" NOT NULL,
    "subscription_catalog_id" "uuid" NOT NULL,
    "is_visible" boolean DEFAULT true NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."calendar_subscription_installs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."calendars" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "avatar_url" "text",
    "event_layout" "text" DEFAULT 'compact'::"text" NOT NULL,
    "access_mode" "public"."calendar_access_mode" DEFAULT 'public_open'::"public"."calendar_access_mode" NOT NULL,
    "event_field_settings" "jsonb" DEFAULT "public"."get_default_calendar_event_field_settings"() NOT NULL,
    "layout_options" "jsonb" DEFAULT "public"."get_default_calendar_layout_options"() NOT NULL,
    CONSTRAINT "calendars_event_field_settings_valid_check" CHECK ("public"."is_valid_calendar_event_field_settings"("event_field_settings")),
    CONSTRAINT "calendars_event_layout_check" CHECK (("event_layout" = ANY (ARRAY['compact'::"text", 'split'::"text"]))),
    CONSTRAINT "calendars_layout_options_valid_check" CHECK ("public"."is_valid_calendar_layout_options"("layout_options"))
);


ALTER TABLE "public"."calendars" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "calendar_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "options" "jsonb" DEFAULT "jsonb_build_object"('visibleByDefault', true, 'color', "public"."random_event_category_color"()) NOT NULL,
    CONSTRAINT "event_categories_options_valid_check" CHECK ("public"."is_valid_event_category_options"("options"))
);


ALTER TABLE "public"."event_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_category_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."event_category_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_favorites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."event_favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "calendar_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "action" "public"."event_history_action" NOT NULL,
    "actor_user_id" "uuid",
    "summary" "text" NOT NULL,
    "changes" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."event_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'participant'::"text" NOT NULL,
    "added_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_participants_role_check" CHECK (("role" = 'participant'::"text"))
);


ALTER TABLE "public"."event_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "user_id" "uuid" NOT NULL,
    "plan" "text" DEFAULT 'free'::"text",
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_event_favorites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "calendar_id" "uuid" NOT NULL,
    "event_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."subscription_event_favorites" OWNER TO "postgres";


ALTER TABLE ONLY "public"."calendar_members"
    ADD CONSTRAINT "calendar_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calendar_members"
    ADD CONSTRAINT "calendar_members_user_id_calendar_id_key" UNIQUE ("user_id", "calendar_id");



ALTER TABLE ONLY "public"."calendar_subscription_catalogs"
    ADD CONSTRAINT "calendar_subscription_catalogs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calendar_subscription_catalogs"
    ADD CONSTRAINT "calendar_subscription_catalogs_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."calendar_subscription_installs"
    ADD CONSTRAINT "calendar_subscription_install_calendar_id_subscription_cata_key" UNIQUE ("calendar_id", "subscription_catalog_id");



ALTER TABLE ONLY "public"."calendar_subscription_installs"
    ADD CONSTRAINT "calendar_subscription_installs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calendars"
    ADD CONSTRAINT "calendars_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_categories"
    ADD CONSTRAINT "event_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_category_assignments"
    ADD CONSTRAINT "event_category_assignments_event_id_category_id_key" UNIQUE ("event_id", "category_id");



ALTER TABLE ONLY "public"."event_category_assignments"
    ADD CONSTRAINT "event_category_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_favorites"
    ADD CONSTRAINT "event_favorites_event_id_user_id_key" UNIQUE ("event_id", "user_id");



ALTER TABLE ONLY "public"."event_favorites"
    ADD CONSTRAINT "event_favorites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_history"
    ADD CONSTRAINT "event_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_participants"
    ADD CONSTRAINT "event_participants_event_id_user_id_key" UNIQUE ("event_id", "user_id");



ALTER TABLE ONLY "public"."event_participants"
    ADD CONSTRAINT "event_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."subscription_event_favorites"
    ADD CONSTRAINT "subscription_event_favorites_calendar_id_event_id_user_id_key" UNIQUE ("calendar_id", "event_id", "user_id");



ALTER TABLE ONLY "public"."subscription_event_favorites"
    ADD CONSTRAINT "subscription_event_favorites_pkey" PRIMARY KEY ("id");



CREATE INDEX "calendar_members_calendar_user_idx" ON "public"."calendar_members" USING "btree" ("calendar_id", "user_id");



CREATE INDEX "calendar_members_user_status_calendar_idx" ON "public"."calendar_members" USING "btree" ("user_id", "status", "calendar_id");



CREATE INDEX "calendar_subscription_catalogs_source_calendar_idx" ON "public"."calendar_subscription_catalogs" USING "btree" ("source_calendar_id");



CREATE INDEX "calendar_subscription_catalogs_source_category_idx" ON "public"."calendar_subscription_catalogs" USING "btree" ("source_category_id");



CREATE INDEX "calendar_subscription_catalogs_visibility_idx" ON "public"."calendar_subscription_catalogs" USING "btree" ("visibility", "is_active");



CREATE INDEX "calendar_subscription_installs_calendar_idx" ON "public"."calendar_subscription_installs" USING "btree" ("calendar_id", "is_visible");



CREATE UNIQUE INDEX "event_categories_calendar_name_uidx" ON "public"."event_categories" USING "btree" ("calendar_id", "lower"("name"));



CREATE INDEX "event_categories_calendar_updated_idx" ON "public"."event_categories" USING "btree" ("calendar_id", "updated_at" DESC, "created_at" DESC);



CREATE INDEX "event_category_assignments_category_created_idx" ON "public"."event_category_assignments" USING "btree" ("category_id", "created_at");



CREATE INDEX "event_category_assignments_event_created_idx" ON "public"."event_category_assignments" USING "btree" ("event_id", "created_at");



CREATE INDEX "event_favorites_user_created_idx" ON "public"."event_favorites" USING "btree" ("user_id", "created_at" DESC, "event_id");



CREATE INDEX "event_history_calendar_occurred_idx" ON "public"."event_history" USING "btree" ("calendar_id", "occurred_at" DESC);



CREATE INDEX "event_history_event_occurred_idx" ON "public"."event_history" USING "btree" ("event_id", "occurred_at" DESC);



CREATE INDEX "event_participants_event_created_idx" ON "public"."event_participants" USING "btree" ("event_id", "created_at");



CREATE INDEX "event_participants_user_idx" ON "public"."event_participants" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "events_calendar_start_created_idx" ON "public"."events" USING "btree" ("calendar_id", "start_at", "created_at");



CREATE INDEX "subscription_event_favorites_calendar_event_idx" ON "public"."subscription_event_favorites" USING "btree" ("calendar_id", "event_id");



CREATE INDEX "subscription_event_favorites_user_created_idx" ON "public"."subscription_event_favorites" USING "btree" ("user_id", "created_at" DESC, "calendar_id");



CREATE OR REPLACE TRIGGER "broadcast_calendar_event_category_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."event_categories" FOR EACH ROW EXECUTE FUNCTION "public"."broadcast_calendar_event_category_change"();



CREATE OR REPLACE TRIGGER "broadcast_calendar_event_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."broadcast_calendar_event_change"();



CREATE OR REPLACE TRIGGER "broadcast_calendar_settings_change" AFTER UPDATE OF "name", "avatar_url", "access_mode", "event_layout", "event_field_settings", "layout_options" ON "public"."calendars" FOR EACH ROW EXECUTE FUNCTION "public"."broadcast_calendar_settings_change"();



CREATE OR REPLACE TRIGGER "broadcast_subscription_catalog_change" AFTER UPDATE OF "status", "is_active" ON "public"."calendar_subscription_catalogs" FOR EACH ROW EXECUTE FUNCTION "public"."broadcast_subscription_catalog_change"();



CREATE OR REPLACE TRIGGER "broadcast_subscription_event_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."broadcast_subscription_event_change"();



CREATE OR REPLACE TRIGGER "log_calendar_event_history" AFTER INSERT OR DELETE OR UPDATE ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."log_calendar_event_history"();



CREATE OR REPLACE TRIGGER "mark_subscription_catalog_source_deleted" BEFORE UPDATE OF "source_calendar_id", "source_category_id" ON "public"."calendar_subscription_catalogs" FOR EACH ROW EXECUTE FUNCTION "public"."mark_subscription_catalog_source_deleted"();



CREATE OR REPLACE TRIGGER "set_calendar_updated_at" BEFORE UPDATE ON "public"."calendars" FOR EACH ROW EXECUTE FUNCTION "public"."set_calendar_updated_at"();



CREATE OR REPLACE TRIGGER "set_event_category_assignment_write_metadata" BEFORE INSERT ON "public"."event_category_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."set_event_category_assignment_write_metadata"();



CREATE OR REPLACE TRIGGER "set_event_category_updated_at" BEFORE INSERT OR UPDATE ON "public"."event_categories" FOR EACH ROW EXECUTE FUNCTION "public"."set_event_category_updated_at"();



CREATE OR REPLACE TRIGGER "set_event_favorite_write_metadata" BEFORE INSERT ON "public"."event_favorites" FOR EACH ROW EXECUTE FUNCTION "public"."set_event_favorite_write_metadata"();



CREATE OR REPLACE TRIGGER "set_event_participant_write_metadata" BEFORE INSERT ON "public"."event_participants" FOR EACH ROW EXECUTE FUNCTION "public"."set_event_participant_write_metadata"();



CREATE OR REPLACE TRIGGER "set_event_write_metadata" BEFORE INSERT OR UPDATE ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."set_event_write_metadata"();



CREATE OR REPLACE TRIGGER "touch_calendar_subscription_catalogs_updated_at" BEFORE UPDATE ON "public"."calendar_subscription_catalogs" FOR EACH ROW EXECUTE FUNCTION "public"."touch_calendar_subscription_updated_at"();



CREATE OR REPLACE TRIGGER "touch_calendar_subscription_installs_updated_at" BEFORE UPDATE ON "public"."calendar_subscription_installs" FOR EACH ROW EXECUTE FUNCTION "public"."touch_calendar_subscription_updated_at"();



ALTER TABLE ONLY "public"."calendar_members"
    ADD CONSTRAINT "calendar_members_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendars"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calendar_members"
    ADD CONSTRAINT "calendar_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calendar_subscription_catalogs"
    ADD CONSTRAINT "calendar_subscription_catalogs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."calendar_subscription_catalogs"
    ADD CONSTRAINT "calendar_subscription_catalogs_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."calendar_subscription_catalogs"
    ADD CONSTRAINT "calendar_subscription_catalogs_source_calendar_id_fkey" FOREIGN KEY ("source_calendar_id") REFERENCES "public"."calendars"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."calendar_subscription_catalogs"
    ADD CONSTRAINT "calendar_subscription_catalogs_source_category_id_fkey" FOREIGN KEY ("source_category_id") REFERENCES "public"."event_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."calendar_subscription_installs"
    ADD CONSTRAINT "calendar_subscription_installs_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendars"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calendar_subscription_installs"
    ADD CONSTRAINT "calendar_subscription_installs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."calendar_subscription_installs"
    ADD CONSTRAINT "calendar_subscription_installs_subscription_catalog_id_fkey" FOREIGN KEY ("subscription_catalog_id") REFERENCES "public"."calendar_subscription_catalogs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calendars"
    ADD CONSTRAINT "calendars_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_categories"
    ADD CONSTRAINT "event_categories_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendars"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_categories"
    ADD CONSTRAINT "event_categories_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."event_category_assignments"
    ADD CONSTRAINT "event_category_assignments_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."event_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_category_assignments"
    ADD CONSTRAINT "event_category_assignments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."event_category_assignments"
    ADD CONSTRAINT "event_category_assignments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_favorites"
    ADD CONSTRAINT "event_favorites_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_favorites"
    ADD CONSTRAINT "event_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_history"
    ADD CONSTRAINT "event_history_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."event_history"
    ADD CONSTRAINT "event_history_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendars"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_history"
    ADD CONSTRAINT "event_history_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_participants"
    ADD CONSTRAINT "event_participants_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."event_participants"
    ADD CONSTRAINT "event_participants_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_participants"
    ADD CONSTRAINT "event_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendars"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."event_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscription_event_favorites"
    ADD CONSTRAINT "subscription_event_favorites_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendars"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscription_event_favorites"
    ADD CONSTRAINT "subscription_event_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "active members can view event history" ON "public"."event_history" FOR SELECT TO "authenticated" USING ("public"."is_active_calendar_member"("calendar_id"));



CREATE POLICY "calendar managers can update calendars" ON "public"."calendars" FOR UPDATE TO "authenticated" USING ("public"."has_calendar_role"("id", ARRAY['manager'::"text", 'owner'::"text"])) WITH CHECK ("public"."has_calendar_role"("id", ARRAY['manager'::"text", 'owner'::"text"]));



CREATE POLICY "calendar managers can update members" ON "public"."calendar_members" FOR UPDATE TO "authenticated" USING ("public"."has_calendar_role"("calendar_id", ARRAY['manager'::"text", 'owner'::"text"])) WITH CHECK ("public"."has_calendar_role"("calendar_id", ARRAY['manager'::"text", 'owner'::"text"]));



CREATE POLICY "calendar subscription catalogs are deletable by managers" ON "public"."calendar_subscription_catalogs" FOR DELETE USING ((("owner_user_id" = "auth"."uid"()) OR (("source_calendar_id" IS NOT NULL) AND "public"."has_calendar_role"("source_calendar_id", ARRAY['manager'::"text", 'owner'::"text"]))));



CREATE POLICY "calendar subscription catalogs are insertable by editors" ON "public"."calendar_subscription_catalogs" FOR INSERT WITH CHECK ((("auth"."uid"() IS NOT NULL) AND ("created_by" = "auth"."uid"()) AND (("source_type" = 'system_holiday'::"text") OR (("source_calendar_id" IS NOT NULL) AND "public"."has_calendar_role"("source_calendar_id", ARRAY['editor'::"text", 'manager'::"text", 'owner'::"text"])))));



CREATE POLICY "calendar subscription catalogs are readable" ON "public"."calendar_subscription_catalogs" FOR SELECT USING ((("is_active" = true) AND (("visibility" = 'public'::"text") OR ("owner_user_id" = "auth"."uid"()) OR (("source_calendar_id" IS NOT NULL) AND "public"."is_active_calendar_member"("source_calendar_id")) OR (EXISTS ( SELECT 1
   FROM "public"."calendar_subscription_installs" "installs"
  WHERE (("installs"."subscription_catalog_id" = "calendar_subscription_catalogs"."id") AND "public"."is_active_calendar_member"("installs"."calendar_id")))))));



CREATE POLICY "calendar subscription catalogs are updatable by managers" ON "public"."calendar_subscription_catalogs" FOR UPDATE USING ((("owner_user_id" = "auth"."uid"()) OR (("source_calendar_id" IS NOT NULL) AND "public"."has_calendar_role"("source_calendar_id", ARRAY['manager'::"text", 'owner'::"text"])))) WITH CHECK ((("owner_user_id" = "auth"."uid"()) OR (("source_calendar_id" IS NOT NULL) AND "public"."has_calendar_role"("source_calendar_id", ARRAY['manager'::"text", 'owner'::"text"]))));



CREATE POLICY "calendar subscription installs are readable by members" ON "public"."calendar_subscription_installs" FOR SELECT USING ("public"."is_active_calendar_member"("calendar_id"));



CREATE POLICY "calendar subscription installs are writable by editors" ON "public"."calendar_subscription_installs" USING ("public"."has_calendar_role"("calendar_id", ARRAY['editor'::"text", 'manager'::"text", 'owner'::"text"])) WITH CHECK ("public"."has_calendar_role"("calendar_id", ARRAY['editor'::"text", 'manager'::"text", 'owner'::"text"]));



ALTER TABLE "public"."calendar_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."calendar_subscription_catalogs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."calendar_subscription_installs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."calendars" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_category_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_favorites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "members can create events" ON "public"."events" FOR INSERT TO "authenticated" WITH CHECK (("public"."has_calendar_role"("calendar_id", ARRAY['editor'::"text", 'manager'::"text", 'owner'::"text"]) AND ("created_by" = "auth"."uid"())));



CREATE POLICY "members can delete events" ON "public"."events" FOR DELETE TO "authenticated" USING ("public"."can_update_calendar_event"("calendar_id", "created_by", "is_locked"));



CREATE POLICY "members can manage event categories" ON "public"."event_categories" TO "authenticated" USING ("public"."has_calendar_role"("calendar_id", ARRAY['editor'::"text", 'manager'::"text", 'owner'::"text"])) WITH CHECK ("public"."has_calendar_role"("calendar_id", ARRAY['editor'::"text", 'manager'::"text", 'owner'::"text"]));



CREATE POLICY "members can manage event category assignments" ON "public"."event_category_assignments" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "events"
  WHERE (("events"."id" = "event_category_assignments"."event_id") AND "public"."can_update_calendar_event"("events"."calendar_id", "events"."created_by", "events"."is_locked"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."events" "events"
     JOIN "public"."event_categories" "categories" ON ((("categories"."id" = "event_category_assignments"."category_id") AND ("categories"."calendar_id" = "events"."calendar_id"))))
  WHERE (("events"."id" = "event_category_assignments"."event_id") AND "public"."can_update_calendar_event"("events"."calendar_id", "events"."created_by", "events"."is_locked")))));



CREATE POLICY "members can manage event participants" ON "public"."event_participants" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "events"
  WHERE (("events"."id" = "event_participants"."event_id") AND "public"."can_update_calendar_event"("events"."calendar_id", "events"."created_by", "events"."is_locked"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."events" "events"
     JOIN "public"."calendar_members" "members" ON ((("members"."calendar_id" = "events"."calendar_id") AND ("members"."user_id" = "event_participants"."user_id") AND ("members"."status" = 'active'::"public"."calendar_member_status"))))
  WHERE (("events"."id" = "event_participants"."event_id") AND "public"."can_update_calendar_event"("events"."calendar_id", "events"."created_by", "events"."is_locked")))));



CREATE POLICY "members can manage own event favorites" ON "public"."event_favorites" TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."events" "events"
  WHERE (("events"."id" = "event_favorites"."event_id") AND "public"."is_active_calendar_member"("events"."calendar_id")))))) WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."events" "events"
  WHERE (("events"."id" = "event_favorites"."event_id") AND "public"."is_active_calendar_member"("events"."calendar_id"))))));



CREATE POLICY "members can manage own subscription event favorites" ON "public"."subscription_event_favorites" TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND "public"."is_active_calendar_member"("calendar_id"))) WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."is_active_calendar_member"("calendar_id")));



CREATE POLICY "members can update events" ON "public"."events" FOR UPDATE TO "authenticated" USING ("public"."can_update_calendar_event"("calendar_id", "created_by", "is_locked")) WITH CHECK ("public"."can_update_calendar_event"("calendar_id", "created_by", "is_locked"));



CREATE POLICY "members can view event categories" ON "public"."event_categories" FOR SELECT USING (("public"."is_active_calendar_member"("calendar_id") OR "public"."is_calendar_publicly_viewable"("calendar_id")));



CREATE POLICY "members can view event category assignments" ON "public"."event_category_assignments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "events"
  WHERE (("events"."id" = "event_category_assignments"."event_id") AND ("public"."is_active_calendar_member"("events"."calendar_id") OR "public"."is_calendar_publicly_viewable"("events"."calendar_id"))))));



CREATE POLICY "members can view event participants" ON "public"."event_participants" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "events"
  WHERE (("events"."id" = "event_participants"."event_id") AND "public"."is_active_calendar_member"("events"."calendar_id")))));



CREATE POLICY "members can view own event favorites" ON "public"."event_favorites" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."events" "events"
  WHERE (("events"."id" = "event_favorites"."event_id") AND "public"."is_active_calendar_member"("events"."calendar_id"))))));



CREATE POLICY "members can view own subscription event favorites" ON "public"."subscription_event_favorites" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND "public"."is_active_calendar_member"("calendar_id")));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_event_favorites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users can access own profile" ON "public"."profiles" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "users can create initial owner membership" ON "public"."calendar_members" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND ("role" = 'owner'::"public"."calendar_role") AND ("status" = 'active'::"public"."calendar_member_status") AND (EXISTS ( SELECT 1
   FROM "public"."calendars"
  WHERE (("calendars"."id" = "calendar_members"."calendar_id") AND ("calendars"."created_by" = "auth"."uid"()))))));



CREATE POLICY "users can create own calendars" ON "public"."calendars" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "users can join public calendars" ON "public"."calendar_members" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND ("role" = 'editor'::"public"."calendar_role") AND ((("status" = 'active'::"public"."calendar_member_status") AND (EXISTS ( SELECT 1
   FROM "public"."calendars"
  WHERE (("calendars"."id" = "calendar_members"."calendar_id") AND ("calendars"."access_mode" = 'public_open'::"public"."calendar_access_mode"))))) OR (("status" = 'pending'::"public"."calendar_member_status") AND (EXISTS ( SELECT 1
   FROM "public"."calendars"
  WHERE (("calendars"."id" = "calendar_members"."calendar_id") AND ("calendars"."access_mode" = 'public_approval'::"public"."calendar_access_mode"))))))));



CREATE POLICY "users can view calendars they created" ON "public"."calendars" FOR SELECT TO "authenticated" USING (("created_by" = "auth"."uid"()));



CREATE POLICY "users can view members" ON "public"."calendar_members" FOR SELECT USING (("public"."is_active_calendar_member"("calendar_id") OR (("user_id" = "auth"."uid"()) AND ("status" = 'pending'::"public"."calendar_member_status"))));



CREATE POLICY "users can view visible calendars" ON "public"."calendars" FOR SELECT USING (("public"."is_active_calendar_member"("id") OR "public"."is_calendar_publicly_viewable"("id")));



CREATE POLICY "users can view visible events" ON "public"."events" FOR SELECT USING (("public"."is_active_calendar_member"("calendar_id") OR "public"."is_calendar_publicly_viewable"("calendar_id")));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."calendar_members";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."calendars";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."events";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."profiles";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."broadcast_calendar_event_category_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."broadcast_calendar_event_category_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."broadcast_calendar_event_category_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."broadcast_calendar_event_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."broadcast_calendar_event_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."broadcast_calendar_event_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."broadcast_calendar_settings_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."broadcast_calendar_settings_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."broadcast_calendar_settings_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."broadcast_subscription_catalog_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."broadcast_subscription_catalog_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."broadcast_subscription_catalog_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."broadcast_subscription_event_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."broadcast_subscription_event_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."broadcast_subscription_event_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."build_calendar_event_category_realtime_record"("target_category_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."build_calendar_event_category_realtime_record"("target_category_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."build_calendar_event_category_realtime_record"("target_category_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."event_category_matches_calendar"("target_category_id" "uuid", "target_calendar_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."event_category_matches_calendar"("target_category_id" "uuid", "target_calendar_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."event_category_matches_calendar"("target_category_id" "uuid", "target_calendar_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_valid_event_exceptions"("target" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."is_valid_event_exceptions"("target" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_valid_event_exceptions"("target" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_valid_event_recurrence"("target" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."is_valid_event_recurrence"("target" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_valid_event_recurrence"("target" "jsonb") TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON FUNCTION "public"."build_calendar_event_history_changes"("old_event" "public"."events", "new_event" "public"."events", "operation" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."build_calendar_event_history_changes"("old_event" "public"."events", "new_event" "public"."events", "operation" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."build_calendar_event_history_changes"("old_event" "public"."events", "new_event" "public"."events", "operation" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."build_calendar_event_history_summary"("target_action" "public"."event_history_action", "target_changes" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."build_calendar_event_history_summary"("target_action" "public"."event_history_action", "target_changes" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."build_calendar_event_history_summary"("target_action" "public"."event_history_action", "target_changes" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."build_calendar_event_realtime_record"("target_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."build_calendar_event_realtime_record"("target_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."build_calendar_event_realtime_record"("target_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."build_calendar_settings_realtime_record"("target_calendar_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."build_calendar_settings_realtime_record"("target_calendar_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."build_calendar_settings_realtime_record"("target_calendar_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."build_event_history_change"("field_name" "text", "field_label" "text", "before_value" "jsonb", "after_value" "jsonb", "include_values" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."build_event_history_change"("field_name" "text", "field_label" "text", "before_value" "jsonb", "after_value" "jsonb", "include_values" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."build_event_history_change"("field_name" "text", "field_label" "text", "before_value" "jsonb", "after_value" "jsonb", "include_values" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."can_access_calendar_workspace_topic"("target_topic" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_calendar_workspace_topic"("target_topic" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_calendar_workspace_topic"("target_topic" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_access_subscription_catalog_topic"("target_topic" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_subscription_catalog_topic"("target_topic" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_subscription_catalog_topic"("target_topic" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_update_calendar_event"("target_calendar_id" "uuid", "event_creator" "uuid", "locked" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."can_update_calendar_event"("target_calendar_id" "uuid", "event_creator" "uuid", "locked" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_update_calendar_event"("target_calendar_id" "uuid", "event_creator" "uuid", "locked" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_calendar_event_category"("target_category_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_calendar_event_category"("target_category_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_calendar_event_category"("target_category_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_current_user_account"() TO "anon";
GRANT ALL ON FUNCTION "public"."delete_current_user_account"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_current_user_account"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_owned_calendar"("target_calendar_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_owned_calendar"("target_calendar_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_owned_calendar"("target_calendar_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_calendar_event_by_id"("target_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_calendar_event_by_id"("target_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_calendar_event_by_id"("target_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_calendar_event_categories"("target_calendar_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_calendar_event_categories"("target_calendar_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_calendar_event_categories"("target_calendar_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_calendar_event_history"("target_event_id" "uuid", "history_limit" integer, "history_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_calendar_event_history"("target_event_id" "uuid", "history_limit" integer, "history_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_calendar_event_history"("target_event_id" "uuid", "history_limit" integer, "history_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_calendar_events_with_authors"("target_calendar_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_calendar_events_with_authors"("target_calendar_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_calendar_events_with_authors"("target_calendar_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_calendar_id_from_workspace_topic"("target_topic" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_calendar_id_from_workspace_topic"("target_topic" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_calendar_id_from_workspace_topic"("target_topic" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_calendar_initial_data"("target_calendar_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_calendar_initial_data"("target_calendar_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_calendar_initial_data"("target_calendar_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_calendar_installed_subscriptions"("target_calendar_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_calendar_installed_subscriptions"("target_calendar_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_calendar_installed_subscriptions"("target_calendar_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_calendar_member_directory"("target_calendar_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_calendar_member_directory"("target_calendar_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_calendar_member_directory"("target_calendar_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_calendar_subscription_catalog"("target_calendar_id" "uuid", "search_query" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_calendar_subscription_catalog"("target_calendar_id" "uuid", "search_query" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_calendar_subscription_catalog"("target_calendar_id" "uuid", "search_query" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_calendar_workspace_topic"("target_calendar_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_calendar_workspace_topic"("target_calendar_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_calendar_workspace_topic"("target_calendar_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_catalog_id_from_subscription_topic"("target_topic" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_catalog_id_from_subscription_topic"("target_topic" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_catalog_id_from_subscription_topic"("target_topic" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_collection_publish_status"("target_calendar_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_collection_publish_status"("target_calendar_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_collection_publish_status"("target_calendar_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_default_calendar_event_field_settings"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_default_calendar_event_field_settings"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_default_calendar_event_field_settings"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_default_calendar_layout_options"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_default_calendar_layout_options"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_default_calendar_layout_options"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_discover_calendars"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_discover_calendars"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_discover_calendars"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_event_categories_json"("target_event_id" "uuid", "include_details" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."get_event_categories_json"("target_event_id" "uuid", "include_details" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_event_categories_json"("target_event_id" "uuid", "include_details" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_event_participants_json"("target_event_id" "uuid", "include_details" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."get_event_participants_json"("target_event_id" "uuid", "include_details" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_event_participants_json"("target_event_id" "uuid", "include_details" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_favorite_calendar_events"("target_calendar_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_favorite_calendar_events"("target_calendar_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_favorite_calendar_events"("target_calendar_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_shared_collection_subscription_events"("p_catalog_id" "uuid", "p_calendar_id" "uuid", "p_range_start" timestamp with time zone, "p_range_end" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_shared_collection_subscription_events"("p_catalog_id" "uuid", "p_calendar_id" "uuid", "p_range_start" timestamp with time zone, "p_range_end" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_shared_collection_subscription_events"("p_catalog_id" "uuid", "p_calendar_id" "uuid", "p_range_start" timestamp with time zone, "p_range_end" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_calendar_role"("target_calendar_id" "uuid", "allowed_roles" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."has_calendar_role"("target_calendar_id" "uuid", "allowed_roles" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_calendar_role"("target_calendar_id" "uuid", "allowed_roles" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_active_calendar_member"("target_calendar_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_active_calendar_member"("target_calendar_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_active_calendar_member"("target_calendar_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_calendar_member"("target_calendar_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_calendar_member"("target_calendar_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_calendar_member"("target_calendar_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_calendar_publicly_viewable"("target_calendar_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_calendar_publicly_viewable"("target_calendar_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_calendar_publicly_viewable"("target_calendar_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_calendar_workspace_topic_private"("target_calendar_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_calendar_workspace_topic_private"("target_calendar_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_calendar_workspace_topic_private"("target_calendar_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_valid_calendar_event_field_settings"("target" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."is_valid_calendar_event_field_settings"("target" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_valid_calendar_event_field_settings"("target" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_valid_calendar_layout_options"("target" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."is_valid_calendar_layout_options"("target" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_valid_calendar_layout_options"("target" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_valid_event_category_color"("target" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_valid_event_category_color"("target" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_valid_event_category_color"("target" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_valid_event_category_options"("target" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."is_valid_event_category_options"("target" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_valid_event_category_options"("target" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."join_public_calendar"("target_calendar_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."join_public_calendar"("target_calendar_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."join_public_calendar"("target_calendar_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."leave_calendar"("target_calendar_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."leave_calendar"("target_calendar_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."leave_calendar"("target_calendar_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_calendar_event_history"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_calendar_event_history"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_calendar_event_history"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_subscription_catalog_source_deleted"() TO "anon";
GRANT ALL ON FUNCTION "public"."mark_subscription_catalog_source_deleted"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_subscription_catalog_source_deleted"() TO "service_role";



GRANT ALL ON FUNCTION "public"."publish_collection_as_subscription"("target_calendar_id" "uuid", "target_category_id" "uuid", "p_name" "text", "p_description" "text", "p_visibility" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."publish_collection_as_subscription"("target_calendar_id" "uuid", "target_category_id" "uuid", "p_name" "text", "p_description" "text", "p_visibility" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."publish_collection_as_subscription"("target_calendar_id" "uuid", "target_category_id" "uuid", "p_name" "text", "p_description" "text", "p_visibility" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."random_event_category_color"() TO "anon";
GRANT ALL ON FUNCTION "public"."random_event_category_color"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."random_event_category_color"() TO "service_role";



GRANT ALL ON FUNCTION "public"."remove_calendar_member"("target_member_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."remove_calendar_member"("target_member_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_calendar_member"("target_member_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."replace_calendar_event_categories"("target_event_id" "uuid", "target_category_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."replace_calendar_event_categories"("target_event_id" "uuid", "target_category_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."replace_calendar_event_categories"("target_event_id" "uuid", "target_category_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."replace_calendar_event_participants"("target_event_id" "uuid", "target_user_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."replace_calendar_event_participants"("target_event_id" "uuid", "target_user_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."replace_calendar_event_participants"("target_event_id" "uuid", "target_user_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_calendar_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_calendar_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_calendar_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_event_category_assignment_write_metadata"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_event_category_assignment_write_metadata"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_event_category_assignment_write_metadata"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_event_category_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_event_category_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_event_category_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_event_favorite_write_metadata"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_event_favorite_write_metadata"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_event_favorite_write_metadata"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_event_participant_write_metadata"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_event_participant_write_metadata"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_event_participant_write_metadata"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_event_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_event_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_event_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_event_write_metadata"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_event_write_metadata"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_event_write_metadata"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_calendar_subscription_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_calendar_subscription_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_calendar_subscription_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."unpublish_collection_subscription"("target_calendar_id" "uuid", "target_category_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."unpublish_collection_subscription"("target_calendar_id" "uuid", "target_category_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unpublish_collection_subscription"("target_calendar_id" "uuid", "target_category_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_calendar_event_with_conflict_resolution"("target_event_id" "uuid", "expected_updated_at" timestamp with time zone, "patch" "jsonb", "changed_fields" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."update_calendar_event_with_conflict_resolution"("target_event_id" "uuid", "expected_updated_at" timestamp with time zone, "patch" "jsonb", "changed_fields" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_calendar_event_with_conflict_resolution"("target_event_id" "uuid", "expected_updated_at" timestamp with time zone, "patch" "jsonb", "changed_fields" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_calendar_event_category"("target_calendar_id" "uuid", "target_name" "text", "target_options" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_calendar_event_category"("target_calendar_id" "uuid", "target_name" "text", "target_options" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_calendar_event_category"("target_calendar_id" "uuid", "target_name" "text", "target_options" "jsonb") TO "service_role";


















GRANT ALL ON TABLE "public"."calendar_members" TO "anon";
GRANT ALL ON TABLE "public"."calendar_members" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_members" TO "service_role";



GRANT ALL ON TABLE "public"."calendar_subscription_catalogs" TO "anon";
GRANT ALL ON TABLE "public"."calendar_subscription_catalogs" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_subscription_catalogs" TO "service_role";



GRANT ALL ON TABLE "public"."calendar_subscription_installs" TO "anon";
GRANT ALL ON TABLE "public"."calendar_subscription_installs" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_subscription_installs" TO "service_role";



GRANT ALL ON TABLE "public"."calendars" TO "anon";
GRANT ALL ON TABLE "public"."calendars" TO "authenticated";
GRANT ALL ON TABLE "public"."calendars" TO "service_role";



GRANT ALL ON TABLE "public"."event_categories" TO "anon";
GRANT ALL ON TABLE "public"."event_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."event_categories" TO "service_role";



GRANT ALL ON TABLE "public"."event_category_assignments" TO "anon";
GRANT ALL ON TABLE "public"."event_category_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."event_category_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."event_favorites" TO "anon";
GRANT ALL ON TABLE "public"."event_favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."event_favorites" TO "service_role";



GRANT ALL ON TABLE "public"."event_history" TO "anon";
GRANT ALL ON TABLE "public"."event_history" TO "authenticated";
GRANT ALL ON TABLE "public"."event_history" TO "service_role";



GRANT ALL ON TABLE "public"."event_participants" TO "anon";
GRANT ALL ON TABLE "public"."event_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."event_participants" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_event_favorites" TO "anon";
GRANT ALL ON TABLE "public"."subscription_event_favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_event_favorites" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";




































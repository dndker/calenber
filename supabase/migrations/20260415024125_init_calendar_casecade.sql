-- calendars.created_by 수정
alter table calendars
drop constraint calendars_created_by_fkey;

alter table calendars
add constraint calendars_created_by_fkey foreign key (created_by) references auth.users (id) on delete cascade;

-- events.created_by 수정
alter table events
drop constraint events_created_by_fkey;

alter table events
add constraint events_created_by_fkey foreign key (created_by) references auth.users (id) on delete cascade;

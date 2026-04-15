create or replace function public.convert_event_content_text_to_jsonb(
    content_text text
)
returns jsonb
language plpgsql
immutable
as $$
begin
    if content_text is null or btrim(content_text) = '' then
        return jsonb_build_array(
            jsonb_build_object(
                'type', 'paragraph',
                'content', jsonb_build_array()
            )
        );
    end if;

    begin
        return content_text::jsonb;
    exception
        when others then
            return jsonb_build_array(
                jsonb_build_object(
                    'type', 'paragraph',
                    'content', jsonb_build_array(content_text)
                )
            );
    end;
end;
$$;

alter table public.events
alter column content type jsonb
using public.convert_event_content_text_to_jsonb(content);

drop function public.convert_event_content_text_to_jsonb(text);

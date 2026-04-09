"use client"

import { GlobeIcon } from "lucide-react"

import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@workspace/ui/components/combobox"

import {
    Item,
    ItemContent,
    ItemDescription,
    ItemTitle,
} from "@workspace/ui/components/item"

import { useCalendarStore } from "@/store/useCalendarStore"
import { InputGroupAddon } from "@workspace/ui/components/input-group"
import { useMemo } from "react"

const timezones = [
    {
        label: "Seoul",
        value: "Asia/Seoul",
        description: "(GMT+9) South Korea",
    },
    {
        label: "Tokyo",
        value: "Asia/Tokyo",
        description: "(GMT+9) Japan",
    },
    {
        label: "Shanghai",
        value: "Asia/Shanghai",
        description: "(GMT+8) China",
    },
    {
        label: "Singapore",
        value: "Asia/Singapore",
        description: "(GMT+8) Singapore",
    },
    {
        label: "Dubai",
        value: "Asia/Dubai",
        description: "(GMT+4) UAE",
    },
    {
        label: "Sydney",
        value: "Australia/Sydney",
        description: "(GMT+11) Australia",
    },
    {
        label: "New York",
        value: "America/New_York",
        description: "(GMT-5) USA (Eastern)",
    },
    {
        label: "Los Angeles",
        value: "America/Los_Angeles",
        description: "(GMT-8) USA (Pacific)",
    },
    {
        label: "Chicago",
        value: "America/Chicago",
        description: "(GMT-6) USA (Central)",
    },
    {
        label: "Toronto",
        value: "America/Toronto",
        description: "(GMT-5) Canada",
    },
    {
        label: "Vancouver",
        value: "America/Vancouver",
        description: "(GMT-8) Canada",
    },
    {
        label: "São Paulo",
        value: "America/Sao_Paulo",
        description: "(GMT-3) Brazil",
    },
    {
        label: "London",
        value: "Europe/London",
        description: "(GMT+0) UK",
    },
    {
        label: "Paris",
        value: "Europe/Paris",
        description: "(GMT+1) France",
    },
    {
        label: "Berlin",
        value: "Europe/Berlin",
        description: "(GMT+1) Germany",
    },
    {
        label: "Rome",
        value: "Europe/Rome",
        description: "(GMT+1) Italy",
    },
    {
        label: "Madrid",
        value: "Europe/Madrid",
        description: "(GMT+1) Spain",
    },
    {
        label: "Amsterdam",
        value: "Europe/Amsterdam",
        description: "(GMT+1) Netherlands",
    },
]

export function TimezoneSelect() {
    const calendarTimezone = useCalendarStore((s) => s.calendarTimezone)
    const setCalendarTimezone = useCalendarStore((s) => s.setCalendarTimezone)

    const selected = useMemo(
        () => timezones.find((tz) => tz.value === calendarTimezone),
        [calendarTimezone]
    )

    return (
        <Combobox
            items={timezones}
            value={selected}
            itemToStringValue={(item) => item.label}
            onValueChange={(item) => {
                if (!item) return
                setCalendarTimezone(item.value)

                document.cookie = `calendar-timezone=${encodeURIComponent(
                    item.value
                )}; path=/; max-age=31536000`
            }}
        >
            <ComboboxInput placeholder="지역 선택" className="w-35">
                <InputGroupAddon>
                    <GlobeIcon />
                </InputGroupAddon>
            </ComboboxInput>

            <ComboboxContent alignOffset={-28} className="w-60">
                <ComboboxEmpty>No timezones found.</ComboboxEmpty>

                <ComboboxList>
                    {(item) => (
                        <ComboboxItem
                            key={item.value}
                            value={item} // 🔥 object
                        >
                            <Item size="xs" className="p-0">
                                <ItemContent>
                                    <ItemTitle className="whitespace-nowrap">
                                        {item.label}
                                    </ItemTitle>
                                    <ItemDescription className="mt-0.75 text-sm opacity-85">
                                        {item.description}
                                    </ItemDescription>
                                </ItemContent>
                            </Item>
                        </ComboboxItem>
                    )}
                </ComboboxList>
            </ComboboxContent>
        </Combobox>
    )
}

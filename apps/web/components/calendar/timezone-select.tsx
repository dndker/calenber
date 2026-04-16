"use client"

import { ClockIcon } from "lucide-react"
import { useMemo, type RefObject } from "react"

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

import { InputGroupAddon } from "@workspace/ui/components/input-group"

import { cn } from "@workspace/ui/lib/utils"
import { TIMEZONES, type TimezoneOption } from "./timezone"

type Props = {
    value?: string
    onChange?: (value: string, option: TimezoneOption) => void
    className?: string
    portalContainer?: RefObject<HTMLElement | null>
    disabled?: boolean
}

export function TimezoneSelect({
    value,
    className,
    onChange,
    portalContainer,
    disabled = false,
}: Props) {
    const selected = useMemo(
        () => TIMEZONES.find((tz) => tz.value === value),
        [value]
    )

    return (
        <Combobox
            modal={false}
            items={TIMEZONES}
            value={selected}
            itemToStringValue={(item) => item.time}
            onValueChange={(item) => {
                if (!item) return
                onChange?.(item.value, item)
            }}
        >
            <ComboboxInput
                placeholder="지역 선택"
                className={cn("w-44", className)}
                disabled={disabled}
            >
                <InputGroupAddon>
                    <ClockIcon />
                </InputGroupAddon>
            </ComboboxInput>

            <ComboboxContent
                container={portalContainer}
                alignOffset={-28}
                className="w-60"
            >
                <ComboboxEmpty>No timezones found.</ComboboxEmpty>

                <ComboboxList>
                    {(item) => (
                        <ComboboxItem key={item.value} value={item}>
                            <Item size="xs" className="p-0">
                                <ItemContent>
                                    <ItemTitle className="whitespace-nowrap">
                                        {item.label}
                                    </ItemTitle>
                                    <ItemDescription className="mt-0.75 text-sm opacity-85">
                                        {item.time} {item.description}
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

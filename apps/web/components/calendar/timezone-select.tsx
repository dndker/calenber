"use client"

import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import { ClockIcon } from "lucide-react"
import { useMemo } from "react"

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
    contentClassName?: string
    portalContainer?: HTMLElement | null
    disabled?: boolean
    icon?: boolean
    alignOffset?: number
}

export function TimezoneSelect({
    value,
    className,
    contentClassName,
    onChange,
    portalContainer,
    icon = true,
    disabled = false,
    alignOffset = -28,
}: Props) {
    const t = useDebugTranslations("settings.profileGeneral")
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
                placeholder={t("timezoneLabel")}
                className={cn(
                    "w-44 [&_input]:text-sm md:[&_input]:text-base",
                    className
                )}
                disabled={disabled}
            >
                {icon && (
                    <InputGroupAddon>
                        <ClockIcon />
                    </InputGroupAddon>
                )}
            </ComboboxInput>

            <ComboboxContent
                container={portalContainer ?? undefined}
                alignOffset={alignOffset}
                className={cn("w-60", contentClassName)}
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

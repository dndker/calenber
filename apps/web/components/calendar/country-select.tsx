"use client"

import { GlobeIcon } from "lucide-react"
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
import { COUNTRIES, CountryOption } from "./country"

type Props = {
    value?: string
    onChange?: (value: string, option: CountryOption) => void
    className?: string
    portalContainer?: RefObject<HTMLElement | null>
    disabled?: boolean
}

export function CountrySelect({
    value,
    className,
    onChange,
    portalContainer,
    disabled = false,
}: Props) {
    const selected = useMemo(
        () => COUNTRIES.find((tz) => tz.value === value),
        [value]
    )

    return (
        <Combobox
            modal={false}
            defaultInputValue="South Korea"
            items={COUNTRIES}
            value={selected}
            itemToStringValue={(item) => item.label}
            onValueChange={(item) => {
                if (!item) return
                onChange?.(item.value, item)
            }}
        >
            <ComboboxInput
                placeholder="언어 선택"
                className={cn("w-44", className)}
                disabled={disabled}
            >
                <InputGroupAddon>
                    <GlobeIcon />
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
                                        {item.continent}
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

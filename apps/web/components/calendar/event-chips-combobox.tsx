"use client"

import {
    Combobox,
    ComboboxChip,
    ComboboxChips,
    ComboboxChipsInput,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxItem,
    ComboboxList,
    ComboboxValue,
    useComboboxAnchor,
} from "@workspace/ui/components/combobox"
import {
    type CompositionEvent,
    type KeyboardEvent,
    type ReactNode,
    useMemo,
    useRef,
    useState,
} from "react"

const comboboxChipsClass =
    "w-full cursor-pointer bg-input/10 py-0.75 not-focus-within:border-transparent! not-focus-within:bg-transparent!"

const comboboxChipClass =
    "flex h-full items-center gap-1.5 rounded-full px-2.5! pr-2.75! text-sm dark:bg-input/50"

export type EventChipsComboboxOption<TData = unknown> = {
    value: string
    label: string
    searchText?: string
    isCreate?: boolean
    data?: TData
}

type EventChipsComboboxProps<TData = unknown> = {
    options: EventChipsComboboxOption<TData>[]
    value: string[]
    disabled?: boolean
    invalid?: boolean
    placeholder?: string
    emptyText: string
    onValueChange: (value: string[]) => void
    renderChipContent?: (option: EventChipsComboboxOption<TData>) => ReactNode
    renderItemContent?: (option: EventChipsComboboxOption<TData>) => ReactNode
    createOptionFromQuery?: (
        query: string
    ) => EventChipsComboboxOption<TData> | null
    chipClassName?: string
    showRemove?: boolean
    closeOnSelect?: boolean
    inputClassName?: string
}

function normalizeQuery(value: string) {
    return value.trim().toLowerCase()
}

export function EventChipsCombobox<TData = unknown>({
    options,
    value,
    disabled = false,
    invalid = false,
    placeholder,
    emptyText,
    onValueChange,
    renderChipContent,
    renderItemContent,
    createOptionFromQuery,
    chipClassName = comboboxChipClass,
    showRemove = true,
    closeOnSelect = false,
    inputClassName,
}: EventChipsComboboxProps<TData>) {
    const anchor = useComboboxAnchor()
    const inputRef = useRef<HTMLInputElement | null>(null)
    const isComposingRef = useRef(false)
    const shouldCommitAfterCompositionRef = useRef(false)
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState("")

    const baseOptionMap = useMemo(
        () => new Map(options.map((option) => [option.value, option])),
        [options]
    )

    const filteredOptions = useMemo(() => {
        const normalizedQuery = normalizeQuery(query)
        const matches = options.filter((option) => {
            if (!normalizedQuery) {
                return true
            }

            return (option.searchText ?? option.label)
                .toLowerCase()
                .includes(normalizedQuery)
        })

        if (!createOptionFromQuery || !normalizedQuery) {
            return matches
        }

        const hasExactMatch = options.some(
            (option) => normalizeQuery(option.label) === normalizedQuery
        )

        if (hasExactMatch) {
            return matches
        }

        const createdOption = createOptionFromQuery(query.trim())

        return createdOption ? [createdOption, ...matches] : matches
    }, [createOptionFromQuery, options, query])

    const filteredOptionMap = useMemo(
        () => new Map(filteredOptions.map((option) => [option.value, option])),
        [filteredOptions]
    )

    const selectedOptions = useMemo(
        () =>
            value.map(
                (selectedValue) =>
                    filteredOptionMap.get(selectedValue) ??
                    baseOptionMap.get(selectedValue) ?? {
                        value: selectedValue,
                        label: selectedValue,
                    }
            ),
        [baseOptionMap, filteredOptionMap, value]
    )

    const filteredValues = useMemo(
        () => filteredOptions.map((option) => option.value),
        [filteredOptions]
    )

    const commitCreatedOption = (rawQuery?: string) => {
        if (!createOptionFromQuery) {
            return false
        }

        const nextQuery = (rawQuery ?? query).trim()
        const createdOption = createOptionFromQuery(nextQuery)

        if (!createdOption) {
            return false
        }

        onValueChange(Array.from(new Set([...value, createdOption.value])))
        setQuery("")
        setOpen(false)
        return true
    }

    const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        const isCompositionKey =
            isComposingRef.current ||
            event.nativeEvent.isComposing ||
            event.nativeEvent.keyCode === 229

        if (isCompositionKey && event.key === "Enter") {
            shouldCommitAfterCompositionRef.current = true
            event.preventDefault()
            event.stopPropagation()
            return
        }

        if (
            !createOptionFromQuery ||
            !query.trim() ||
            (event.key !== "Enter" && event.key !== "Tab" && event.key !== ",")
        ) {
            return
        }

        event.preventDefault()
        commitCreatedOption()
    }

    const handleCompositionStart = () => {
        isComposingRef.current = true
        shouldCommitAfterCompositionRef.current = false
    }

    const handleCompositionEnd = (
        event: CompositionEvent<HTMLInputElement>
    ) => {
        isComposingRef.current = false

        const completedQuery = event.currentTarget.value
        setQuery(completedQuery)

        if (!shouldCommitAfterCompositionRef.current) {
            return
        }

        shouldCommitAfterCompositionRef.current = false

        if (!completedQuery.trim()) {
            return
        }

        commitCreatedOption(completedQuery)
    }

    return (
        <Combobox
            open={open}
            onOpenChange={setOpen}
            disabled={disabled}
            multiple
            autoHighlight
            items={filteredValues}
            value={value}
            itemToStringValue={(selectedValue) =>
                baseOptionMap.get(selectedValue)?.label ?? selectedValue
            }
            onValueChange={(nextValue) => {
                onValueChange(nextValue)
                setQuery("")

                if (closeOnSelect) {
                    setOpen(false)
                    inputRef.current?.blur()
                }
            }}
        >
            <ComboboxChips
                ref={anchor}
                className={comboboxChipsClass}
                aria-invalid={invalid}
            >
                <ComboboxValue>
                    {() => (
                        <>
                            {selectedOptions.map((option) => (
                                <ComboboxChip
                                    className={chipClassName}
                                    key={option.value}
                                    showRemove={showRemove}
                                >
                                    {renderChipContent
                                        ? renderChipContent(option)
                                        : option.label}
                                </ComboboxChip>
                            ))}
                            <ComboboxChipsInput
                                ref={inputRef}
                                value={query}
                                onChange={(event) => {
                                    setQuery(event.target.value)
                                    setOpen(true)
                                }}
                                onCompositionStart={handleCompositionStart}
                                onCompositionEnd={handleCompositionEnd}
                                onKeyDown={handleInputKeyDown}
                                className={
                                    inputClassName ??
                                    "cursor-pointer focus:cursor-text"
                                }
                                placeholder={value.length === 0 ? placeholder : ""}
                            />
                        </>
                    )}
                </ComboboxValue>
            </ComboboxChips>
            <ComboboxContent anchor={anchor} className="dark:bg-muted">
                <ComboboxEmpty>{emptyText}</ComboboxEmpty>
                <ComboboxList>
                    {(itemValue) => {
                        const option = filteredOptionMap.get(itemValue)

                        if (!option) {
                            return null
                        }

                        return (
                            <ComboboxItem
                                className="py-1.5 dark:hover:bg-input/50"
                                key={option.value}
                                value={option.value}
                            >
                                {renderItemContent
                                    ? renderItemContent(option)
                                    : option.label}
                            </ComboboxItem>
                        )
                    }}
                </ComboboxList>
            </ComboboxContent>
        </Combobox>
    )
}

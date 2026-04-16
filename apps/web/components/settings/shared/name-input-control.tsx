"use client"

import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from "@workspace/ui/components/input-group"
import { Spinner } from "@workspace/ui/components/spinner"

export function NameInputControl({
    value,
    placeholder,
    disabled = false,
    invalid = false,
    isSaving = false,
    className,
    minLength,
    maxLength,
    onChange,
}: {
    value: string
    placeholder: string
    disabled?: boolean
    invalid?: boolean
    isSaving?: boolean
    className?: string
    minLength?: number
    maxLength?: number
    onChange: (value: string) => void
}) {
    return (
        <InputGroup className={className}>
            <InputGroupInput
                placeholder={placeholder}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                aria-invalid={invalid}
                disabled={disabled}
                minLength={minLength}
                maxLength={maxLength}
                className={className}
            />
            {isSaving && (
                <InputGroupAddon align="inline-end">
                    <Spinner />
                </InputGroupAddon>
            )}
        </InputGroup>
    )
}

"use client"

import { Button as ShadButton } from "@workspace/ui/components/button"
import { forwardRef } from "react"

export const BNButton = forwardRef<
    HTMLButtonElement,
    React.ComponentProps<typeof ShadButton>
>((props, ref) => {
    return <ShadButton ref={ref} {...props} />
})

BNButton.displayName = "BNButton"

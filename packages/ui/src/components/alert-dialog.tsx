"use client"

import { AlertDialog as AlertDialogPrimitive } from "radix-ui"
import * as React from "react"

import { Button } from "@workspace/ui/components/button"
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerTitle,
    DrawerTrigger,
} from "@workspace/ui/components/drawer"
import { useIsMobile } from "@workspace/ui/hooks/use-mobile"
import { cn } from "@workspace/ui/lib/utils"

type AlertDialogContextValue = {
    isMobile: boolean
    open: boolean
    onOpenChange: (open: boolean) => void
}

const AlertDialogContext = React.createContext<AlertDialogContextValue | null>(
    null
)

function useAlertDialogContext() {
    const context = React.useContext(AlertDialogContext)

    if (!context) {
        throw new Error(
            "AlertDialog components must be used within <AlertDialog>."
        )
    }

    return context
}

function AlertDialog({
    open: openProp,
    defaultOpen = false,
    onOpenChange,
    children,
    ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
    const isMobile = useIsMobile()
    const [uncontrolledOpen, setUncontrolledOpen] =
        React.useState(defaultOpen)
    const isControlled = openProp !== undefined
    const open = isControlled ? openProp : uncontrolledOpen

    const setOpen = React.useCallback(
        (nextOpen: boolean) => {
            if (!isControlled) {
                setUncontrolledOpen(nextOpen)
            }

            onOpenChange?.(nextOpen)
        },
        [isControlled, onOpenChange]
    )

    const contextValue = React.useMemo(
        () => ({
            isMobile,
            open,
            onOpenChange: setOpen,
        }),
        [isMobile, open, setOpen]
    )

    if (isMobile) {
        return (
            <AlertDialogContext.Provider value={contextValue}>
                <Drawer
                    open={open}
                    onOpenChange={setOpen}
                    dismissible={false}
                >
                    {children}
                </Drawer>
            </AlertDialogContext.Provider>
        )
    }

    return (
        <AlertDialogContext.Provider value={contextValue}>
            <AlertDialogPrimitive.Root
                open={open}
                onOpenChange={setOpen}
                {...props}
            >
                {children}
            </AlertDialogPrimitive.Root>
        </AlertDialogContext.Provider>
    )
}

function AlertDialogTrigger({
    ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
    const { isMobile } = useAlertDialogContext()

    if (isMobile) {
        return <DrawerTrigger data-slot="alert-dialog-trigger" {...props} />
    }

    return <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
}

function AlertDialogPortal({
    children,
    ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {
    const { isMobile } = useAlertDialogContext()

    if (isMobile) {
        return <>{children}</>
    }

    return (
        <AlertDialogPrimitive.Portal
            data-slot="alert-dialog-portal"
            {...props}
        >
            {children}
        </AlertDialogPrimitive.Portal>
    )
}

function AlertDialogOverlay({
    className,
    ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
    const { isMobile } = useAlertDialogContext()

    if (isMobile) {
        return null
    }

    return (
        <AlertDialogPrimitive.Overlay
            data-slot="alert-dialog-overlay"
            className={cn(
                "fixed inset-0 z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
                className
            )}
            {...props}
        />
    )
}

function AlertDialogContent({
    className,
    size = "default",
    children,
    ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content> & {
    size?: "default" | "sm"
}) {
    const { isMobile } = useAlertDialogContext()

    if (isMobile) {
        return (
            <DrawerContent
                data-slot="alert-dialog-content"
                data-size={size}
                className={cn(
                    "group/alert-dialog-content grid gap-4 rounded-t-xl bg-popover p-4 text-popover-foreground",
                    className
                )}
            >
                {children}
            </DrawerContent>
        )
    }

    return (
        <AlertDialogPortal>
            <AlertDialogOverlay />
            <AlertDialogPrimitive.Content
                data-slot="alert-dialog-content"
                data-size={size}
                className={cn(
                    "group/alert-dialog-content fixed top-1/2 left-1/2 z-50 grid w-full -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none data-[size=default]:max-w-xs data-[size=sm]:max-w-xs data-[size=default]:sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
                    className
                )}
                {...props}
            >
                {children}
            </AlertDialogPrimitive.Content>
        </AlertDialogPortal>
    )
}

function AlertDialogHeader({
    className,
    ...props
}: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="alert-dialog-header"
            className={cn(
                "grid grid-rows-[auto_1fr] place-items-center gap-1.5 text-center has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] has-data-[slot=alert-dialog-media]:gap-x-4 sm:group-data-[size=default]/alert-dialog-content:place-items-start sm:group-data-[size=default]/alert-dialog-content:text-left sm:group-data-[size=default]/alert-dialog-content:has-data-[slot=alert-dialog-media]:grid-rows-[auto_1fr]",
                className
            )}
            {...props}
        />
    )
}

function AlertDialogFooter({
    className,
    ...props
}: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="alert-dialog-footer"
            className={cn(
                "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end",
                "border-t-0 bg-background pt-0",
                className
            )}
            {...props}
        />
    )
}

function AlertDialogMedia({
    className,
    ...props
}: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="alert-dialog-media"
            className={cn(
                "mb-2 inline-flex size-10 items-center justify-center rounded-md bg-muted sm:group-data-[size=default]/alert-dialog-content:row-span-2 *:[svg:not([class*='size-'])]:size-6",
                className
            )}
            {...props}
        />
    )
}

function AlertDialogTitle({
    className,
    ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
    const { isMobile } = useAlertDialogContext()

    if (isMobile) {
        return (
            <DrawerTitle
                data-slot="alert-dialog-title"
                className={cn(
                    "font-heading text-base font-medium sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2",
                    className
                )}
                {...props}
            />
        )
    }

    return (
        <AlertDialogPrimitive.Title
            data-slot="alert-dialog-title"
            className={cn(
                "font-heading text-base font-medium sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2",
                className
            )}
            {...props}
        />
    )
}

function AlertDialogDescription({
    className,
    ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
    const { isMobile } = useAlertDialogContext()

    if (isMobile) {
        return (
            <DrawerDescription
                data-slot="alert-dialog-description"
                className={cn(
                    "text-sm text-balance text-muted-foreground md:text-pretty *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
                    className
                )}
                {...props}
            />
        )
    }

    return (
        <AlertDialogPrimitive.Description
            data-slot="alert-dialog-description"
            className={cn(
                "text-sm text-balance text-muted-foreground md:text-pretty *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
                className
            )}
            {...props}
        />
    )
}

function AlertDialogAction({
    className,
    variant = "default",
    size = "default",
    onClick,
    ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Action> &
    Pick<React.ComponentProps<typeof Button>, "variant" | "size">) {
    const { isMobile, onOpenChange } = useAlertDialogContext()

    if (isMobile) {
        return (
            <Button
                variant={variant}
                size={size}
                data-slot="alert-dialog-action"
                className={cn(className)}
                onClick={(event) => {
                    onClick?.(event)

                    if (!event.defaultPrevented) {
                        onOpenChange(false)
                    }
                }}
                {...props}
            />
        )
    }

    return (
        <Button variant={variant} size={size} asChild>
            <AlertDialogPrimitive.Action
                data-slot="alert-dialog-action"
                className={cn(className)}
                onClick={onClick}
                {...props}
            />
        </Button>
    )
}

function AlertDialogCancel({
    className,
    variant = "outline",
    size = "default",
    onClick,
    ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Cancel> &
    Pick<React.ComponentProps<typeof Button>, "variant" | "size">) {
    const { isMobile, onOpenChange } = useAlertDialogContext()

    if (isMobile) {
        return (
            <Button
                variant={variant}
                size={size}
                data-slot="alert-dialog-cancel"
                className={cn(className)}
                onClick={(event) => {
                    onClick?.(event)

                    if (!event.defaultPrevented) {
                        onOpenChange(false)
                    }
                }}
                {...props}
            />
        )
    }

    return (
        <Button variant={variant} size={size} asChild>
            <AlertDialogPrimitive.Cancel
                data-slot="alert-dialog-cancel"
                className={cn(className)}
                onClick={onClick}
                {...props}
            />
        </Button>
    )
}

export {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogMedia,
    AlertDialogOverlay,
    AlertDialogPortal,
    AlertDialogTitle,
    AlertDialogTrigger,
}

import { cva, type VariantProps } from "class-variance-authority"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Slot } from "radix-ui"
import * as React from "react"

import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"

const buttonVariants = cva(
    "group/button inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none disabled:pointer-events-none disabled:cursor-default disabled:opacity-50 has-[svg]:leading-[normal] aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    {
        variants: {
            variant: {
                default:
                    "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
                outline:
                    "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
                secondary:
                    "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
                ghost: "dark:not[data-selected=true]:hover:bg-muted/50 hover:not[data-selected=true]:text-foreground hover:bg-muted aria-expanded:bg-muted aria-expanded:text-foreground",
                destructive:
                    "bg-destructive/10 text-destructive hover:bg-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30",
                link: "text-primary underline-offset-4 hover:underline",
            },
            size: {
                default:
                    "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
                xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
                sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
                lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
                icon: "size-8",
                "icon-xs":
                    "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
                "icon-sm":
                    "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
                "icon-lg": "size-9",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
)

function Button({
    className,
    variant = "default",
    size = "default",
    asChild = false,
    loading = false,
    effect = false,
    effectActive = false,
    children,
    disabled,
    style,
    ...props
}: React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
        asChild?: boolean
        loading?: boolean
        /**
         * Enables the button active effect.
         */
        effect?: boolean
        /**
         * Plays the effect only when this value turns true.
         */
        effectActive?: boolean
    }) {
    const Comp = asChild ? Slot.Root : "button"
    const prefersReducedMotion = useReducedMotion()
    const canRenderEffect =
        !asChild && !loading && !disabled && effect && !prefersReducedMotion
    const [effectKey, setEffectKey] = React.useState(0)
    const [hasTriggeredEffect, setHasTriggeredEffect] = React.useState(false)
    const previousEffectActiveRef = React.useRef(effectActive)

    React.useEffect(() => {
        const didTurnOn = !previousEffectActiveRef.current && effectActive
        previousEffectActiveRef.current = effectActive

        if (canRenderEffect && didTurnOn) {
            setHasTriggeredEffect(true)
            setEffectKey((prev) => prev + 1)
        }
    }, [canRenderEffect, effectActive])

    const mergedStyle = canRenderEffect
        ? ({
              ...style,
              "--button-effect-color": "currentColor",
          } as React.CSSProperties)
        : style

    return (
        <Comp
            data-slot="button"
            data-variant={variant}
            data-size={size}
            className={cn(
                buttonVariants({ variant, size, className }),
                canRenderEffect && "relative isolate overflow-hidden"
            )}
            disabled={loading || disabled}
            style={mergedStyle}
            {...props}
        >
            <AnimatePresence>
                {canRenderEffect && effectActive && hasTriggeredEffect && (
                    <motion.span
                        key={effectKey}
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 z-0 rounded-[inherit]"
                        initial={{ opacity: 1 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.span
                            className="pointer-events-none absolute top-1/2 left-1/2 block size-[150%] -translate-x-1/2 -translate-y-1/2 rounded-full"
                            initial={{ opacity: 0.74, scale: 0.12 }}
                            animate={{
                                opacity: [0.22, 0.22, 0.22, 0],
                                scale: [0.12, 0.92, 1.24],
                            }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.56, ease: "easeOut" }}
                            style={{
                                background:
                                    "radial-gradient(circle at center, var(--button-effect-color) 0%, color-mix(in srgb, var(--button-effect-color) 62%, transparent) 52%, color-mix(in srgb, var(--button-effect-color) 24%, transparent) 100%)",
                            }}
                        />

                        {Array.from({
                            length: 5,
                        }).map((_, index) => {
                            const angleOffset = Math.PI / 2
                            const angle =
                                angleOffset +
                                (Math.PI * 2 * index) / Math.max(5, 1)
                            const x = Math.cos(angle) * 15
                            const y = Math.sin(angle) * 15

                            return (
                                <motion.span
                                    key={`particle-${effectKey}-${index}`}
                                    aria-hidden="true"
                                    className="pointer-events-none absolute top-1/2 left-1/2 z-0 size-0.75 -translate-x-1/2 -translate-y-1/2 rounded-full"
                                    initial={{
                                        x: Math.cos(angle) * 4,
                                        y: Math.sin(angle) * 4,
                                        opacity: 0,
                                        scale: 0.4,
                                    }}
                                    animate={{
                                        x,
                                        y,
                                        opacity: [0, 0.9, 0],
                                        scale: [0.4, 0.9, 0.4],
                                    }}
                                    exit={{ opacity: 0 }}
                                    transition={{
                                        duration: 0.72,
                                        delay: 0,
                                        ease: "easeOut",
                                    }}
                                    style={{
                                        backgroundColor:
                                            "var(--button-effect-color)",
                                    }}
                                />
                            )
                        })}
                    </motion.span>
                )}
            </AnimatePresence>
            {loading && <Spinner data-icon="inline-start" />}
            {asChild ? (
                <Slot.Slottable>{children}</Slot.Slottable>
            ) : (
                <motion.span
                    className="relative z-10 inline-flex transform-gpu items-center justify-center gap-[inherit] leading-[normal] will-change-transform backface-hidden"
                    initial={false}
                    variants={{
                        idle: { scale: 1 },
                        beat: {
                            scale: [1, 1.2, 0.95, 1],
                            transition: {
                                duration: 0.5,
                                delay: 0.14,
                                ease: "easeOut",
                            },
                        },
                    }}
                    animate={
                        canRenderEffect && effectActive && hasTriggeredEffect
                            ? "beat"
                            : "idle"
                    }
                >
                    {children}
                </motion.span>
            )}
        </Comp>
    )
}

export { Button, buttonVariants }

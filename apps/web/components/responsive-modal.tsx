"use client"

/**
 * ResponsiveModal — 데스크톱에서는 Dialog, 모바일에서는 Drawer로 자동 분기되는
 * 반응형 모달 컴포넌트. event-modal 패턴을 일반화해 재사용 가능하게 추출.
 *
 * 사용 예:
 *   <ResponsiveModal open={open} onOpenChange={setOpen}>
 *     <ResponsiveModalContent title="제목" description="설명">
 *       {children}
 *     </ResponsiveModalContent>
 *   </ResponsiveModal>
 */

import { useMediaQuery } from "@/hooks/use-media-query"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@workspace/ui/components/dialog"
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from "@workspace/ui/components/drawer"
import * as React from "react"

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

type ResponsiveModalContextValue = {
    isDesktop: boolean
    open: boolean
    onOpenChange: (open: boolean) => void
}

const ResponsiveModalContext =
    React.createContext<ResponsiveModalContextValue | null>(null)

function useResponsiveModalContext() {
    const ctx = React.useContext(ResponsiveModalContext)
    if (!ctx) {
        throw new Error(
            "useResponsiveModalContext must be used within <ResponsiveModal>"
        )
    }
    return ctx
}

// ─────────────────────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────────────────────

export interface ResponsiveModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    children: React.ReactNode
}

export function ResponsiveModal({
    open,
    onOpenChange,
    children,
}: ResponsiveModalProps) {
    const isDesktop = useMediaQuery("(min-width: 768px)")

    const ctx = React.useMemo(
        () => ({ isDesktop, open, onOpenChange }),
        [isDesktop, open, onOpenChange]
    )

    return (
        <ResponsiveModalContext.Provider value={ctx}>
            {children}
        </ResponsiveModalContext.Provider>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Content
// ─────────────────────────────────────────────────────────────────────────────

export interface ResponsiveModalContentProps {
    /**
     * 접근성 타이틀 (VisuallyHidden 없이 그대로 표시됨).
     * 숨기려면 직접 className에 sr-only를 주지 말고 title prop을 생략 후
     * children 안에서 직접 렌더링하세요.
     */
    title?: React.ReactNode
    description?: React.ReactNode
    /** Dialog className override */
    className?: string
    /** Drawer className override */
    drawerClassName?: string
    children: React.ReactNode
    /** Dialog footer 영역 — 데스크톱 전용 */
    footer?: React.ReactNode
    /** Drawer footer 영역 — 모바일 전용 */
    drawerFooter?: React.ReactNode
    /**
     * 데스크톱 Dialog의 최대 너비 (기본값: "sm:max-w-lg").
     * Tailwind arbitrary value도 가능: "sm:max-w-[540px]"
     */
    maxWidth?: string
}

export function ResponsiveModalContent({
    title,
    description,
    className,
    drawerClassName,
    children,
    footer,
    drawerFooter,
    maxWidth = "sm:max-w-lg",
}: ResponsiveModalContentProps) {
    const { isDesktop, open, onOpenChange } = useResponsiveModalContext()

    if (isDesktop) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent
                    className={`${maxWidth} ${className ?? ""}`}
                    aria-describedby={description ? undefined : undefined}
                >
                    {(title || description) && (
                        <DialogHeader>
                            {title && <DialogTitle>{title}</DialogTitle>}
                            {description && (
                                <DialogDescription>{description}</DialogDescription>
                            )}
                        </DialogHeader>
                    )}
                    {children}
                    {footer && <DialogFooter>{footer}</DialogFooter>}
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent className={drawerClassName}>
                {(title || description) && (
                    <DrawerHeader>
                        {title && <DrawerTitle>{title}</DrawerTitle>}
                        {description && (
                            <DrawerDescription>{description}</DrawerDescription>
                        )}
                    </DrawerHeader>
                )}
                <div className="overflow-y-auto px-4 pb-2">{children}</div>
                {(drawerFooter ?? footer) && (
                    <DrawerFooter>{drawerFooter ?? footer}</DrawerFooter>
                )}
            </DrawerContent>
        </Drawer>
    )
}

"use client"

import {
    SettingsModal,
    type SettingsTabId,
} from "@/components/settings/settings-modal"
import {
    createContext,
    type ReactNode,
    useCallback,
    useContext,
    useMemo,
    useState,
} from "react"

type SettingsModalContextValue = {
    isOpen: boolean
    initialTab: SettingsTabId
    openSettings: (initialTab?: SettingsTabId) => void
    closeSettings: () => void
    setOpen: (open: boolean) => void
}

const SettingsModalContext = createContext<SettingsModalContextValue | null>(
    null
)

export function SettingsModalProvider({
    children,
}: {
    children: ReactNode
}) {
    const [isOpen, setIsOpen] = useState(false)
    const [initialTab, setInitialTab] = useState<SettingsTabId>("profile")

    const openSettings = useCallback((nextTab: SettingsTabId = "profile") => {
        setInitialTab(nextTab)
        setIsOpen(true)
    }, [])

    const closeSettings = useCallback(() => {
        setIsOpen(false)
    }, [])

    const value = useMemo(
        () => ({
            isOpen,
            initialTab,
            openSettings,
            closeSettings,
            setOpen: setIsOpen,
        }),
        [closeSettings, initialTab, isOpen, openSettings]
    )

    return (
        <SettingsModalContext.Provider value={value}>
            {children}
            <SettingsModal
                open={isOpen}
                onOpenChange={setIsOpen}
                initialTab={initialTab}
            />
        </SettingsModalContext.Provider>
    )
}

export function useSettingsModal() {
    const context = useContext(SettingsModalContext)

    if (!context) {
        throw new Error(
            "useSettingsModal must be used within a SettingsModalProvider."
        )
    }

    return context
}

"use client"

import { createContext, useContext } from "react"

export type Theme = "light" | "dark" | "system"

const ThemeContext = createContext<{ theme: Theme }>({
    theme: "system",
})

export function ThemeContextProvider({
    theme,
    children,
}: {
    theme: Theme
    children: React.ReactNode
}) {
    return (
        <ThemeContext.Provider value={{ theme }}>
            {children}
        </ThemeContext.Provider>
    )
}

export function useServerTheme() {
    return useContext(ThemeContext)
}

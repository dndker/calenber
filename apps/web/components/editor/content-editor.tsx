"use client"

import type { EditorContent } from "@/store/calendar-store.types"
import {
    BlockNoteSchema,
    defaultInlineContentSpecs,
    filterSuggestionItems,
} from "@blocknote/core"
import { ko } from "@blocknote/core/locales"
import {
    AddBlockButton,
    DefaultReactSuggestionItem,
    DragHandleButton,
    SideMenu,
    SideMenuController,
    SuggestionMenuController,
    useCreateBlockNote,
} from "@blocknote/react"
import { BlockNoteView } from "@blocknote/shadcn"
import * as Button from "@workspace/ui/components/button"
import * as DropdownMenu from "@workspace/ui/components/dropdown-menu"
import * as Input from "@workspace/ui/components/input"
import * as Label from "@workspace/ui/components/label"
import * as Popover from "@workspace/ui/components/popover"
import * as Select from "@workspace/ui/components/select"
import * as Tooltip from "@workspace/ui/components/tooltip"
import { useTheme } from "next-themes"
import { useEffect, useRef } from "react"
import { useServerTheme } from "../provider/theme-context"
import { Mention } from "./mention"

type Props = {
    value?: EditorContent
    onChange?: (value: EditorContent) => void
    editable?: boolean
}

// Our schema with inline content specs, which contain the configs and
// implementations for inline content  that we want our editor to use.
const schema = BlockNoteSchema.create({
    inlineContentSpecs: {
        // Adds all default inline content.
        ...defaultInlineContentSpecs,
        // Adds the mention tag.
        mention: Mention,
    },
})
// Function which gets all users for the mentions menu.
const getMentionMenuItems = (
    editor: typeof schema.BlockNoteEditor
): DefaultReactSuggestionItem[] => {
    const users = ["Woong", "Steve", "Bob", "Joe", "Mike"]
    return users.map((user) => ({
        title: user,
        onItemClick: () => {
            editor.insertInlineContent([
                {
                    type: "mention",
                    props: {
                        user,
                    },
                },
                " ", // add a space after the mention
            ])
        },
    }))
}

export default function ContentEditor({
    value,
    onChange,
    editable = true,
}: Props) {
    const isLocalChangeRef = useRef(false)

    const { theme: ssrTheme } = useServerTheme()
    const { resolvedTheme } = useTheme()
    const currentTheme =
        resolvedTheme ?? (ssrTheme === "system" ? "light" : ssrTheme)

    const editor = useCreateBlockNote({
        schema,
        initialContent: value || undefined,
        dictionary: ko,
    })

    const debounceRef = useRef<NodeJS.Timeout | null>(null)

    useEffect(() => {
        if (!editor) return

        return editor.onChange(() => {
            isLocalChangeRef.current = true

            if (debounceRef.current) {
                clearTimeout(debounceRef.current)
            }

            debounceRef.current = setTimeout(() => {
                onChange?.(editor.document as EditorContent)
                isLocalChangeRef.current = false
            }, 700)
        })
    }, [editor, onChange])

    useEffect(() => {
        if (!editor || !value) return
        if (isLocalChangeRef.current) return

        editor.replaceBlocks(editor.document, value)
    }, [value, editor])

    return (
        <BlockNoteView
            key="bn-root"
            editor={editor}
            editable={editable}
            theme={currentTheme as "light" | "dark"}
            data-theme={currentTheme}
            className="bn-root min-h-[40dvh] text-foreground *:bg-transparent! *:px-0!"
            shadCNComponents={{
                Input,
                Label,
                Button,
                DropdownMenu,
                Popover,
                Select,
                Tooltip,
            }}
            sideMenu={false}
        >
            <SideMenuController
                sideMenu={(props) => (
                    <SideMenu {...props}>
                        {/* Button which removes the hovered block. */}
                        <div className="*:size-6 *:text-muted-foreground [&_svg]:size-5!">
                            <AddBlockButton />
                            <DragHandleButton {...props} />
                        </div>
                    </SideMenu>
                )}
            />

            <SuggestionMenuController
                triggerCharacter={"@"}
                getItems={async (query) =>
                    // Gets the mentions menu items
                    filterSuggestionItems(getMentionMenuItems(editor), query)
                }
            />
        </BlockNoteView>
    )
}

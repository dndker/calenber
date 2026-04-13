"use client"

import { EditorContent } from "@/store/useCalendarStore"
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
import { Mention } from "./mention"

type Props = {
    value?: EditorContent
    onChange?: (value: EditorContent) => void
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

export default function ContentEditor({ value, onChange }: Props) {
    const { resolvedTheme } = useTheme()

    const editor = useCreateBlockNote({
        schema,
        initialContent: value || undefined,
        dictionary: ko,
    })

    const debounceRef = useRef<NodeJS.Timeout | null>(null)

    useEffect(() => {
        if (!editor) return

        return editor.onChange(() => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current)
            }

            debounceRef.current = setTimeout(() => {
                onChange?.(editor.document as EditorContent)
            }, 300)
        })
    }, [editor, onChange])

    return (
        <BlockNoteView
            key="bn-root"
            editor={editor}
            theme="light"
            data-theme={resolvedTheme}
            className="bn-root min-h-[40dvh] bg-transparent text-foreground *:px-0!"
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

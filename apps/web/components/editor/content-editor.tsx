"use client"

import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import { CalendarMemberDirectoryItem } from "@/lib/calendar/queries"
import type { EditorContent } from "@/store/calendar-store.types"
import { BlockNoteSchema, defaultInlineContentSpecs } from "@blocknote/core"
import { ko } from "@blocknote/core/locales"
import {
    AddBlockButton,
    DefaultReactSuggestionItem,
    DragHandleButton,
    SideMenu,
    SideMenuController,
    SuggestionMenuController,
    SuggestionMenuProps,
    useCreateBlockNote,
} from "@blocknote/react"
import { BlockNoteView } from "@blocknote/shadcn"
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@workspace/ui/components/avatar"
import * as Button from "@workspace/ui/components/button"
import * as DropdownMenu from "@workspace/ui/components/dropdown-menu"
import * as Input from "@workspace/ui/components/input"
import * as Label from "@workspace/ui/components/label"
import * as Popover from "@workspace/ui/components/popover"
import * as Select from "@workspace/ui/components/select"
import * as Tooltip from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"
import { useTheme } from "next-themes"
import { useEffect, useRef } from "react"
import { useServerTheme } from "../provider/theme-context"
import { Mention } from "./mention"

type Props = {
    value?: EditorContent
    onChange?: (value: EditorContent) => void
    editable?: boolean
    updatedAt?: number
    updatedById?: string | null
    currentUserId?: string | null
    members?: CalendarMemberDirectoryItem[]
}

const schema = BlockNoteSchema.create({
    inlineContentSpecs: {
        ...defaultInlineContentSpecs,
        mention: Mention,
    },
})

type MentionSuggestionItem = DefaultReactSuggestionItem & {
    member: CalendarMemberDirectoryItem
}

function MentionSuggestionMenu({
    items,
    selectedIndex,
    onItemClick,
}: SuggestionMenuProps<MentionSuggestionItem>) {
    const t = useDebugTranslations("common.labels")
    return (
        <div className="max-h-72 min-w-56 overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
            {items.map((item, index) => {
                const member = item.member
                const displayName = item.title
                return (
                    <button
                        key={`${member.userId}-${index}`}
                        type="button"
                        className={cn(
                            "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left",
                            selectedIndex === index
                                ? "bg-accent text-accent-foreground"
                                : "hover:bg-accent/70"
                        )}
                        onClick={() => onItemClick?.(item)}
                    >
                        <Avatar className="size-6.5 shrink-0">
                            <AvatarImage
                                src={member.avatarUrl ?? undefined}
                                alt={displayName}
                            />
                            <AvatarFallback className="text-xs">
                                {displayName?.[0]?.toUpperCase() ?? "?"}
                            </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                            <div className="truncate text-sm font-medium">
                                {displayName}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                                {member.email ?? t("noEmail")}
                            </div>
                        </div>
                    </button>
                )
            })}
        </div>
    )
}

const getMentionMenuItems = (
    editor: typeof schema.BlockNoteEditor,
    members: CalendarMemberDirectoryItem[]
): MentionSuggestionItem[] => {
    return members.map((member) => {
        const displayName = member.name || member.email || member.userId

        return {
            title: displayName,
            subtext: member.email ?? undefined,
            icon: (
                <Avatar className="size-7">
                    <AvatarImage
                        src={member.avatarUrl ?? undefined}
                        alt={displayName}
                    />
                    <AvatarFallback className="text-[10px]">
                        {displayName?.[0]?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                </Avatar>
            ),
            onItemClick: () => {
                editor.insertInlineContent([
                    {
                        type: "mention",
                        props: {
                            user: displayName,
                            userId: member.userId,
                            email: member.email ?? "",
                            avatarUrl: member.avatarUrl ?? "",
                        },
                    },
                    " ",
                ])
            },
            member,
        }
    })
}

export default function ContentEditor({
    value,
    onChange,
    editable = true,
    updatedAt,
    updatedById,
    currentUserId,
    members,
}: Props) {
    // const [isMounted, setIsMounted] = useState(false)

    // useEffect(() => {
    //     setIsMounted(true)
    // }, [])

    // if (!isMounted) {
    //     return null
    // }

    return (
        <ContentEditorClient
            value={value}
            onChange={onChange}
            editable={editable}
            updatedAt={updatedAt}
            updatedById={updatedById}
            currentUserId={currentUserId}
            members={members}
        />
    )
}

function ContentEditorClient({
    value,
    onChange,
    editable = true,
    updatedAt,
    updatedById,
    currentUserId,
    members,
}: Props) {
    const isLocalChangeRef = useRef(false)
    const lastAppliedContentRef = useRef<string | null>(null)
    const lastAppliedUpdatedAtRef = useRef<number | null>(null)

    const { theme: ssrTheme } = useServerTheme()
    const { resolvedTheme } = useTheme()
    const currentTheme =
        resolvedTheme ??
        (document.documentElement.classList.contains("dark")
            ? "dark"
            : ssrTheme === "dark"
              ? "dark"
              : "light")

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
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current)
            }
        }
    }, [])

    useEffect(() => {
        if (!editor || !value) return

        const nextSerializedContent = JSON.stringify(value)
        const currentSerializedContent = JSON.stringify(editor.document)
        const isSameContent = nextSerializedContent === currentSerializedContent
        const isSameAuthor =
            updatedById != null && updatedById === currentUserId
        const isAlreadyApplied =
            lastAppliedContentRef.current === nextSerializedContent &&
            lastAppliedUpdatedAtRef.current === (updatedAt ?? null)

        if (isSameContent) {
            lastAppliedContentRef.current = nextSerializedContent
            lastAppliedUpdatedAtRef.current = updatedAt ?? null
            return
        }

        if (isLocalChangeRef.current || isSameAuthor || isAlreadyApplied) {
            return
        }

        editor.replaceBlocks(editor.document, value)
        lastAppliedContentRef.current = nextSerializedContent
        lastAppliedUpdatedAtRef.current = updatedAt ?? null
    }, [currentUserId, editor, updatedAt, updatedById, value])

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
                        <div className="*:size-6 *:text-muted-foreground [&_svg]:size-5!">
                            <AddBlockButton />
                            <DragHandleButton {...props} />
                        </div>
                    </SideMenu>
                )}
            />

            <SuggestionMenuController<
                (query: string) => Promise<MentionSuggestionItem[]>
            >
                triggerCharacter="@"
                getItems={async (query) => {
                    const mentionItems = getMentionMenuItems(
                        editor,
                        members ?? []
                    )
                    const normalizedQuery = query.trim().toLowerCase()

                    if (!normalizedQuery) {
                        return mentionItems
                    }

                    return mentionItems.filter((item) => {
                        const title = item.title.toLowerCase()
                        const email = item.member.email?.toLowerCase() ?? ""
                        return (
                            title.includes(normalizedQuery) ||
                            email.includes(normalizedQuery)
                        )
                    })
                }}
                suggestionMenuComponent={MentionSuggestionMenu}
            />
        </BlockNoteView>
    )
}

import { createReactInlineContentSpec } from "@blocknote/react"

// The Mention inline content.
export const Mention = createReactInlineContentSpec(
    {
        type: "mention",
        propSchema: {
            user: {
                default: "Unknown",
            },
        },
        content: "none",
    },
    {
        render: (props) => (
            <span className="bg-muted-foreground/15">
                @{props.inlineContent.props.user}
            </span>
        ),
    }
)

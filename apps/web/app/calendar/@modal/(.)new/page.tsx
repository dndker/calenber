"use client"

import * as React from "react"

import { EventForm } from "@/components/calendar/event-form"
import { useCreateEvent } from "@/hooks/use-create-event"
import { useMediaQuery } from "@/hooks/use-media-query"
import { CalendarEvent, useCalendarStore } from "@/store/useCalendarStore"
import { Button } from "@workspace/ui/components/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@workspace/ui/components/dialog"
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from "@workspace/ui/components/drawer"
import { useRouter } from "next/navigation"

export default function DrawerDialogDemo() {
    const router = useRouter()
    const createEvent = useCreateEvent()

    const [open, setOpen] = React.useState(false)
    const isDesktop = useMediaQuery("(min-width: 768px)")

    React.useEffect(() => {
        setOpen(true)
    }, [])

    const handleClose = () => {
        setOpen(false) // 1. 애니메이션 시작

        useCalendarStore.setState({
            selection: { isSelecting: false, start: null, end: null },
        })

        setTimeout(() => {
            router.back() // 2. 애니메이션 끝나고 이동
        }, 200) // 👉 shadcn 기본 애니메이션 시간 (200ms)
    }

    const handleSubmit = async (event: CalendarEvent) => {
        const ok = await createEvent(event)
        if (ok) handleClose()
    }

    if (isDesktop) {
        return (
            <Dialog
                open={open}
                onOpenChange={(v) => {
                    if (!v) handleClose()
                }}
            >
                <DialogContent className="sm:max-w-106.25">
                    <DialogHeader>
                        <DialogTitle>새 일정</DialogTitle>
                        <DialogDescription>
                            간단한 정보를 입력해 일정을 추가해보세요.
                        </DialogDescription>
                    </DialogHeader>
                    <EventForm onSubmit={handleSubmit} />
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <Drawer
            open={open}
            onOpenChange={(v) => {
                if (!v) handleClose()
            }}
        >
            <DrawerContent>
                <DrawerHeader className="text-left">
                    <DrawerTitle>새 일정</DrawerTitle>
                    <DrawerDescription>
                        간단한 정보를 입력해 일정을 추가해보세요.
                    </DrawerDescription>
                </DrawerHeader>
                <EventForm onSubmit={handleSubmit} />
                <DrawerFooter className="pt-2">
                    <DrawerClose asChild>
                        <Button variant="outline">Cancel</Button>
                    </DrawerClose>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    )
}

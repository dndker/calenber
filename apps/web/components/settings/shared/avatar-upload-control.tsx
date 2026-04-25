"use client"

import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@workspace/ui/components/avatar"
import { Spinner } from "@workspace/ui/components/spinner"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { XIcon } from "lucide-react"
import type { ChangeEvent, RefObject } from "react"

export function AvatarUploadControl({
    fileInputRef,
    imageUrl,
    name,
    isUploading,
    isRemoving,
    disabled = false,
    onFileChange,
    onRemove,
}: {
    fileInputRef: RefObject<HTMLInputElement | null>
    imageUrl: string | null
    name: string | null
    isUploading: boolean
    isRemoving: boolean
    disabled?: boolean
    onFileChange: (event: ChangeEvent<HTMLInputElement>) => void
    onRemove: () => void
}) {
    const isBusy = isUploading || isRemoving
    const isInteractive = !disabled && !isBusy

    return (
        <>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={onFileChange}
            />
            <div className="group/avatar relative inline-block w-auto! self-start">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Avatar
                            size="lg"
                            className={
                                isInteractive
                                    ? "size-15! cursor-pointer"
                                    : "size-15! cursor-default opacity-70"
                            }
                            onClick={() => {
                                if (!isInteractive) {
                                    return
                                }

                                fileInputRef.current?.click()
                            }}
                        >
                            <AvatarImage
                                className={
                                    isInteractive
                                        ? "cursor-pointer"
                                        : "cursor-default"
                                }
                                src={imageUrl ?? undefined}
                                alt={name ?? ""}
                            />
                            <AvatarFallback className="text-2xl leading-[normal] font-medium">
                                {name?.[0]?.toUpperCase() ?? ""}
                            </AvatarFallback>
                        </Avatar>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                        <p>
                            {disabled
                                ? "이미지 변경 권한이 없습니다"
                                : imageUrl
                                  ? "사진 변경"
                                  : "사진 업로드"}
                        </p>
                    </TooltipContent>
                </Tooltip>
                {imageUrl && !disabled && (
                    <div
                        className="group/badge absolute top-0 right-0 bottom-auto hidden size-3.75! cursor-pointer items-center justify-center rounded-full bg-muted text-primary ring-2 ring-background group-hover/avatar:flex hover:bg-border"
                        onClick={(event) => {
                            event.stopPropagation()
                            onRemove()
                        }}
                    >
                        <XIcon className="size-2.5" />
                    </div>
                )}
                {isBusy && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/45">
                        <Spinner className="size-4" />
                    </div>
                )}
            </div>
        </>
    )
}

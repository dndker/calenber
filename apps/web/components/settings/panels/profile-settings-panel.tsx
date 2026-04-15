"use client"

import { useAuthStore } from "@/store/useAuthStore"
import { createBrowserSupabase } from "@workspace/lib/supabase/client"
import { mapUser } from "@workspace/lib/supabase/map-user"
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldGroup,
    FieldLabel,
    FieldLegend,
    FieldSeparator,
    FieldSet,
} from "@workspace/ui/components/field"
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from "@workspace/ui/components/input-group"
import { Spinner } from "@workspace/ui/components/spinner"
import { Switch } from "@workspace/ui/components/switch"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { XIcon } from "lucide-react"
import { ChangeEvent, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

const MAX_AVATAR_BYTES = 5 * 1024 * 1024

async function compressAvatarImage(file: File) {
    const imageUrl = URL.createObjectURL(file)

    try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const nextImage = new Image()
            nextImage.onload = () => resolve(nextImage)
            nextImage.onerror = () =>
                reject(new Error("이미지를 불러오지 못했습니다."))
            nextImage.src = imageUrl
        })

        const maxDimension = 768
        const scale = Math.min(
            1,
            maxDimension / Math.max(image.width, image.height)
        )
        const width = Math.max(1, Math.round(image.width * scale))
        const height = Math.max(1, Math.round(image.height * scale))
        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height

        const context = canvas.getContext("2d")

        if (!context) {
            throw new Error("이미지 압축을 준비하지 못했습니다.")
        }

        context.drawImage(image, 0, 0, width, height)

        let quality = 0.86
        let output: Blob | null = null

        while (quality >= 0.4) {
            output = await new Promise<Blob | null>((resolve) => {
                canvas.toBlob(resolve, "image/webp", quality)
            })

            if (output && output.size <= MAX_AVATAR_BYTES) {
                break
            }

            quality -= 0.1
        }

        if (!output) {
            throw new Error("이미지 압축에 실패했습니다.")
        }

        return new File([output], "avatar.webp", { type: "image/webp" })
    } finally {
        URL.revokeObjectURL(imageUrl)
    }
}

export function ProfileSettingsPanel() {
    const user = useAuthStore((s) => s.user)
    const setUser = useAuthStore((s) => s.setUser)
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const [name, setName] = useState(user?.name ?? "")
    const [isSavingName, setIsSavingName] = useState(false)
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
    const [isRemovingAvatar, setIsRemovingAvatar] = useState(false)

    useEffect(() => {
        setName(user?.name ?? "")
    }, [user?.name])

    const trimmedName = name.trim()
    const hasEmptyNameError = trimmedName.length === 0

    useEffect(() => {
        if (!user) {
            return
        }

        const nextName = trimmedName
        const currentName = user.name?.trim() ?? ""

        if (!nextName) {
            return
        }

        if (nextName === currentName) {
            return
        }

        const timeout = window.setTimeout(async () => {
            setIsSavingName(true)

            try {
                const supabase = createBrowserSupabase()
                const { data, error } = await supabase.auth.updateUser({
                    data: {
                        name: nextName,
                        avatar_url: user.avatarUrl,
                    },
                })

                if (error) {
                    throw error
                }

                setUser(mapUser(data.user))
            } catch (error) {
                console.error("Failed to update profile name:", error)
                toast.error("이름을 저장하지 못했습니다.")
            } finally {
                setIsSavingName(false)
            }
        }, 500)

        return () => window.clearTimeout(timeout)
    }, [setUser, trimmedName, user])

    if (!user) return null

    const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]

        if (!file) {
            return
        }

        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
            toast.error("JPG, PNG, WEBP 이미지 파일만 업로드할 수 있습니다.")
            event.target.value = ""
            return
        }

        setIsUploadingAvatar(true)

        try {
            const supabase = createBrowserSupabase()
            const compressedFile = await compressAvatarImage(file)
            const path = `${user.id}/avatar.webp`

            const { error: uploadError } = await supabase.storage
                .from("avatars")
                .upload(path, compressedFile, {
                    cacheControl: "3600",
                    upsert: true,
                })

            if (uploadError) {
                throw uploadError
            }

            const { data: publicUrlData } = supabase.storage
                .from("avatars")
                .getPublicUrl(path)

            const avatarUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`
            const { data, error: updateError } = await supabase.auth.updateUser(
                {
                    data: {
                        name: name.trim(),
                        avatar_url: avatarUrl,
                    },
                }
            )

            if (updateError) {
                throw updateError
            }

            setUser(mapUser(data.user))
            toast.success("프로필 이미지가 업데이트되었습니다.")
        } catch (error) {
            console.error("Avatar upload failed:", error)
            toast.error("프로필 이미지 업로드에 실패했습니다.")
        } finally {
            setIsUploadingAvatar(false)
            event.target.value = ""
        }
    }

    const handleAvatarRemove = async () => {
        if (!user.avatarUrl) {
            return
        }

        setIsRemovingAvatar(true)

        try {
            const supabase = createBrowserSupabase()
            const { error: removeError } = await supabase.storage
                .from("avatars")
                .remove([`${user.id}/avatar.webp`])

            if (removeError) {
                throw removeError
            }

            const { data, error: updateError } = await supabase.auth.updateUser(
                {
                    data: {
                        name: name.trim(),
                        avatar_url: null,
                    },
                }
            )

            if (updateError) {
                throw updateError
            }

            setUser(mapUser(data.user))
            toast.success("프로필 이미지가 삭제되었습니다.")
        } catch (error) {
            console.error("Avatar remove failed:", error)
            toast.error("프로필 이미지 삭제에 실패했습니다.")
        } finally {
            setIsRemovingAvatar(false)
        }
    }

    return (
        <div>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleAvatarUpload}
            />
            <FieldGroup>
                <FieldSet>
                    <FieldLegend className="mb-3.5 font-semibold">
                        계정
                    </FieldLegend>
                    {/* <FieldDescription>
                        All transactions are secure and encrypted
                    </FieldDescription> */}
                    <input type="file" name="" id="" />
                    <FieldGroup>
                        <Field
                            orientation="horizontal"
                            className="items-center! gap-4"
                        >
                            <div className="group/avatar relative">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Avatar
                                            size="lg"
                                            className="size-15!"
                                            onClick={() => {
                                                if (
                                                    isUploadingAvatar ||
                                                    isRemovingAvatar
                                                ) {
                                                    return
                                                }

                                                fileInputRef.current?.click()
                                            }}
                                        >
                                            <AvatarImage
                                                className="cursor-pointer"
                                                src={user.avatarUrl || ""}
                                                alt={user.name || ""}
                                            />
                                            <AvatarFallback>
                                                {user.name || ""}
                                            </AvatarFallback>
                                        </Avatar>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">
                                        <p>
                                            {user.avatarUrl
                                                ? "사진 변경"
                                                : "사진 업로드"}
                                        </p>
                                    </TooltipContent>
                                </Tooltip>
                                {user.avatarUrl && (
                                    <div
                                        className="group/badge absolute top-0 right-0 bottom-auto hidden size-3.75! cursor-pointer items-center justify-center rounded-full bg-muted text-primary ring-2 ring-background group-hover/avatar:flex hover:bg-border"
                                        onClick={(event) => {
                                            event.stopPropagation()
                                            void handleAvatarRemove()
                                        }}
                                    >
                                        <XIcon className="size-2.5" />
                                    </div>
                                )}
                                {(isUploadingAvatar || isRemovingAvatar) && (
                                    <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/45">
                                        <Spinner className="size-4" />
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-col gap-2">
                                <InputGroup>
                                    <InputGroupInput
                                        placeholder="이름 입력.."
                                        value={name}
                                        onChange={(event) =>
                                            setName(event.target.value)
                                        }
                                        aria-invalid={hasEmptyNameError}
                                        className="w-46"
                                        disabled={isSavingName}
                                    />
                                    {isSavingName && (
                                        <InputGroupAddon align="inline-end">
                                            <Spinner />
                                        </InputGroupAddon>
                                    )}
                                </InputGroup>
                            </div>
                        </Field>
                        <Field
                            orientation="horizontal"
                            className="items-center!"
                        >
                            <FieldContent>
                                <FieldLabel htmlFor="switch-focus-mode">
                                    Share across devices
                                </FieldLabel>
                                <FieldDescription>
                                    Focus is shared across devices, and turns
                                    off when you leave the app.
                                </FieldDescription>
                            </FieldContent>
                            <Switch id="switch-focus-mode" />
                        </Field>
                    </FieldGroup>
                </FieldSet>
                <FieldSeparator />
                <FieldSet>
                    <FieldLegend className="mb-3.5 font-semibold">
                        계정 보안
                    </FieldLegend>
                    <FieldGroup>
                        <Field
                            orientation="horizontal"
                            className="items-center!"
                        >
                            <FieldContent>
                                <FieldLabel htmlFor="switch-focus-mode">
                                    이메일
                                </FieldLabel>
                                <FieldDescription>
                                    example@gmail.com
                                </FieldDescription>
                            </FieldContent>
                            <Button variant="outline">이메일 관리</Button>
                        </Field>
                        <Field
                            orientation="horizontal"
                            className="items-center!"
                        >
                            <FieldContent>
                                <FieldLabel htmlFor="switch-focus-mode">
                                    비밀번호
                                </FieldLabel>
                                <FieldDescription>
                                    계정 비밀번호를 설정하세요.
                                </FieldDescription>
                            </FieldContent>
                            <Button variant="outline">비밀번호 설정</Button>
                        </Field>
                        <Field
                            orientation="horizontal"
                            className="items-center!"
                        >
                            <FieldContent>
                                <FieldLabel htmlFor="switch-focus-mode">
                                    2단계 인증
                                </FieldLabel>
                                <FieldDescription>
                                    계정 보안 방식을 추가하세요.
                                </FieldDescription>
                            </FieldContent>
                            <Button variant="outline">인증 방법 추가</Button>
                        </Field>
                    </FieldGroup>
                </FieldSet>
                <FieldSeparator />
                <FieldSet>
                    <FieldLegend className="mb-3.5 font-semibold">
                        지원
                    </FieldLegend>
                    <FieldGroup>
                        <Field
                            orientation="horizontal"
                            className="items-center!"
                        >
                            <FieldContent>
                                <FieldLabel htmlFor="switch-focus-mode">
                                    내 계정 삭제
                                </FieldLabel>
                                <FieldDescription>
                                    계정을 영구저긍로 삭제합니다. 더 이상 내가
                                    만든 캘린더나 소속된 캘린더에 접근할 수
                                    없게됩니다.
                                </FieldDescription>
                            </FieldContent>
                            <Button variant="destructive">내 계정 삭제</Button>
                        </Field>
                    </FieldGroup>
                </FieldSet>
            </FieldGroup>
        </div>
    )
}

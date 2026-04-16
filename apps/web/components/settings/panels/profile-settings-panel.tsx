"use client"

import { AvatarUploadControl } from "@/components/settings/shared/avatar-upload-control"
import { NameInputControl } from "@/components/settings/shared/name-input-control"
import { compressAvatarImage, validateAvatarImage } from "@/lib/avatar-image"
import { useAuthStore } from "@/store/useAuthStore"
import { createBrowserSupabase } from "@workspace/lib/supabase/client"
import { mapUser } from "@workspace/lib/supabase/map-user"
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
import { Switch } from "@workspace/ui/components/switch"
import { ChangeEvent, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

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

    const getAuthenticatedUserId = async () => {
        const supabase = createBrowserSupabase()
        const {
            data: { user: authUser },
            error,
        } = await supabase.auth.getUser()

        if (error) {
            throw error
        }

        if (!authUser) {
            throw new Error("로그인 정보를 확인하지 못했습니다.")
        }

        return {
            supabase,
            authUserId: authUser.id,
        }
    }

    const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]

        if (!file) {
            return
        }

        const validationMessage = validateAvatarImage(file)

        if (validationMessage) {
            toast.error(validationMessage)
            event.target.value = ""
            return
        }

        setIsUploadingAvatar(true)

        try {
            const { supabase, authUserId } = await getAuthenticatedUserId()
            const compressedFile = await compressAvatarImage(file)
            const path = `${authUserId}/avatar.webp`
            const uploadOptions = {
                cacheControl: "3600",
                contentType: compressedFile.type,
            }
            const { error: uploadError } = user.avatarUrl
                ? await supabase.storage
                      .from("avatars")
                      .update(path, compressedFile, uploadOptions)
                : await supabase.storage
                      .from("avatars")
                      .upload(path, compressedFile, uploadOptions)

            if (uploadError) {
                console.error("Avatar upload storage error:", {
                    uploadError,
                    path,
                    storeUserId: user.id,
                    authUserId,
                })
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
            const { supabase, authUserId } = await getAuthenticatedUserId()
            const { error: removeError } = await supabase.storage
                .from("avatars")
                .remove([`${authUserId}/avatar.webp`])

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
            <FieldGroup>
                <FieldSet>
                    <FieldLegend className="mb-4 font-semibold">
                        계정
                    </FieldLegend>
                    {/* <FieldDescription>
                        All transactions are secure and encrypted
                    </FieldDescription> */}
                    <FieldGroup>
                        <Field
                            orientation="horizontal"
                            className="items-center! gap-4"
                        >
                            <AvatarUploadControl
                                fileInputRef={fileInputRef}
                                imageUrl={user.avatarUrl}
                                name={user.name}
                                isUploading={isUploadingAvatar}
                                isRemoving={isRemovingAvatar}
                                onFileChange={handleAvatarUpload}
                                onRemove={() => {
                                    void handleAvatarRemove()
                                }}
                            />
                            <div className="flex flex-col gap-2">
                                <NameInputControl
                                    value={name}
                                    placeholder="이름 입력.."
                                    onChange={setName}
                                    invalid={hasEmptyNameError}
                                    isSaving={isSavingName}
                                    disabled={isSavingName}
                                    className="w-46"
                                />
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
                    <FieldLegend className="mb-4 font-semibold">
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
                    <FieldLegend className="mb-4 font-semibold">
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

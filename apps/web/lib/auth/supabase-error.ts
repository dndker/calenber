type SupabaseLikeError =
    | {
          code?: string | null
          message?: string | null
          status?: number
          name?: string
      }
    | null
    | undefined

const AUTH_ERROR_CODE_MESSAGES: Record<string, string> = {
    anonymous_provider_disabled: "익명 로그인이 비활성화되어 있습니다.",
    bad_code_verifier:
        "인증 요청 정보가 올바르지 않습니다. 다시 시도해 주세요.",
    bad_json: "잘못된 요청 형식입니다.",
    bad_jwt: "인증 정보가 올바르지 않습니다. 다시 로그인해 주세요.",
    bad_oauth_callback:
        "소셜 로그인 응답이 올바르지 않습니다. 다시 시도해 주세요.",
    bad_oauth_state:
        "소셜 로그인 상태 확인에 실패했습니다. 다시 시도해 주세요.",
    email_exists: "이미 가입된 이메일입니다.",
    email_not_confirmed: "이메일 인증이 완료되지 않았습니다.",
    email_provider_disabled: "이메일 로그인이 비활성화되어 있습니다.",
    flow_state_expired: "인증 시간이 만료되었습니다. 다시 시도해 주세요.",
    flow_state_not_found: "인증 상태를 찾을 수 없습니다. 다시 시도해 주세요.",
    hook_payload_invalid_content_type:
        "인증 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    hook_payload_over_size_limit:
        "인증 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    hook_timeout:
        "요청 처리 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.",
    hook_timeout_after_retry:
        "요청 처리 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.",
    identity_already_exists: "이미 연결된 계정입니다.",
    identity_not_found: "계정 정보를 찾을 수 없습니다.",
    insufficient_aal: "추가 인증이 필요합니다.",
    invalid_credentials: "이메일 또는 비밀번호가 올바르지 않습니다.",
    invite_not_found: "초대 링크가 만료되었거나 이미 사용되었습니다.",
    manual_linking_disabled: "계정 연결 기능이 비활성화되어 있습니다.",
    mfa_challenge_expired: "인증 코드가 만료되었습니다. 다시 시도해 주세요.",
    mfa_factor_name_conflict: "이미 사용 중인 인증 수단 이름입니다.",
    mfa_factor_not_found: "인증 수단을 찾을 수 없습니다.",
    mfa_ip_address_mismatch:
        "보안을 위해 같은 네트워크 환경에서 다시 시도해 주세요.",
    mfa_phone_enroll_not_enabled: "휴대폰 MFA 등록이 비활성화되어 있습니다.",
    mfa_phone_verify_not_enabled: "휴대폰 MFA 인증이 비활성화되어 있습니다.",
    mfa_totp_enroll_not_enabled: "OTP 등록이 비활성화되어 있습니다.",
    mfa_totp_verify_not_enabled: "OTP 인증이 비활성화되어 있습니다.",
    mfa_verification_failed: "인증 코드가 올바르지 않습니다.",
    mfa_verification_rejected: "추가 인증이 거부되었습니다.",
    mfa_verified_factor_exists: "이미 인증된 MFA 수단이 있습니다.",
    mfa_web_authn_enroll_not_enabled: "보안 키 등록이 비활성화되어 있습니다.",
    mfa_web_authn_verify_not_enabled: "보안 키 인증이 비활성화되어 있습니다.",
    no_authorization: "인증 정보가 없습니다. 다시 로그인해 주세요.",
    not_admin: "권한이 없습니다.",
    oauth_provider_not_supported: "지원하지 않는 소셜 로그인 제공자입니다.",
    otp_disabled: "OTP 로그인이 비활성화되어 있습니다.",
    otp_expired: "인증 코드가 만료되었습니다. 다시 요청해 주세요.",
    over_email_send_rate_limit: "잠시 후 다시 시도해 주세요.",
    over_request_rate_limit:
        "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    over_sms_send_rate_limit:
        "문자를 너무 자주 보냈습니다. 잠시 후 다시 시도해 주세요.",
    phone_exists: "이미 가입된 전화번호입니다.",
    phone_not_confirmed: "전화번호 인증이 완료되지 않았습니다.",
    phone_provider_disabled: "전화번호 로그인이 비활성화되어 있습니다.",
    pkce_code_verifier_not_found:
        "이메일 인증은 완료되었지만 자동 로그인은 할 수 없습니다. 로그인해 주세요.",
    provider_disabled: "해당 로그인 제공자가 비활성화되어 있습니다.",
    provider_email_needs_verification:
        "소셜 계정 이메일 확인이 필요합니다. 메일함을 확인해 주세요.",
    reauthentication_needed: "보안을 위해 다시 인증해 주세요.",
    reauthentication_not_valid: "재인증 코드가 올바르지 않습니다.",
    refresh_token_already_used: "세션이 만료되었습니다. 다시 로그인해 주세요.",
    refresh_token_not_found: "세션을 찾을 수 없습니다. 다시 로그인해 주세요.",
    request_timeout: "요청 처리 시간이 초과되었습니다. 다시 시도해 주세요.",
    same_password: "현재 비밀번호와 다른 비밀번호를 입력해 주세요.",
    saml_assertion_no_email: "SSO 계정에서 이메일 정보를 찾을 수 없습니다.",
    saml_assertion_no_user_id: "SSO 계정 정보를 찾을 수 없습니다.",
    saml_entity_id_mismatch: "SSO 설정이 올바르지 않습니다.",
    saml_idp_already_exists: "이미 등록된 SSO 제공자입니다.",
    saml_idp_not_found: "SSO 제공자를 찾을 수 없습니다.",
    saml_metadata_fetch_failed: "SSO 설정 정보를 불러오지 못했습니다.",
    saml_provider_disabled: "SSO 로그인이 비활성화되어 있습니다.",
    saml_relay_state_expired:
        "SSO 인증 시간이 만료되었습니다. 다시 시도해 주세요.",
    saml_relay_state_not_found: "SSO 인증 상태를 찾을 수 없습니다.",
    session_expired: "세션이 만료되었습니다. 다시 로그인해 주세요.",
    session_not_found: "세션을 찾을 수 없습니다. 다시 로그인해 주세요.",
    signup_disabled: "회원가입이 비활성화되어 있습니다.",
    single_identity_not_deletable: "마지막 로그인 수단은 삭제할 수 없습니다.",
    sms_send_failed: "문자 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    sso_domain_already_exists: "이미 등록된 SSO 도메인입니다.",
    sso_provider_not_found: "SSO 제공자를 찾을 수 없습니다.",
    too_many_enrolled_mfa_factors: "등록 가능한 인증 수단 수를 초과했습니다.",
    unexpected_audience: "인증 정보가 올바르지 않습니다.",
    unexpected_failure:
        "인증 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    user_already_exists: "이미 가입된 계정입니다.",
    user_banned: "이 계정은 현재 사용할 수 없습니다.",
    user_not_found: "계정을 찾을 수 없습니다.",
    user_sso_managed: "SSO 계정은 직접 수정할 수 없습니다.",
    validation_failed: "입력한 정보가 올바르지 않습니다.",
    weak_password:
        "비밀번호가 너무 약합니다. 더 안전한 비밀번호를 사용해 주세요.",
}

const AUTH_ERROR_MESSAGE_MESSAGES: Record<string, string> = {
    "Invalid login credentials": "이메일 또는 비밀번호가 올바르지 않습니다.",
    "Email not confirmed": "이메일 인증이 완료되지 않았습니다.",
    "User already registered": "이미 가입된 이메일입니다.",
    "Invalid email or password": "이메일 또는 비밀번호가 올바르지 않습니다.",
    "Email rate limit exceeded": "잠시 후 다시 시도해주세요.",
    "Email link is invalid or has expired":
        "이메일 인증 링크가 유효하지 않거나 만료되었습니다.",
    "Token has expired or is invalid":
        "인증 링크가 유효하지 않거나 만료되었습니다.",
    "Signup requires a valid password": "유효한 비밀번호를 입력해 주세요.",
    "Password should be at least 6 characters":
        "비밀번호는 최소 6자 이상이어야 합니다.",
    "Unable to validate email address: invalid format":
        "올바른 이메일 주소를 입력해 주세요.",
    "For security purposes, you can only request this after":
        "잠시 후 다시 시도해 주세요.",
}

function getMessageFromText(message: string | null | undefined) {
    if (!message) {
        return null
    }

    const exactMatch = AUTH_ERROR_MESSAGE_MESSAGES[message]

    if (exactMatch) {
        return exactMatch
    }

    const prefixMatch = Object.entries(AUTH_ERROR_MESSAGE_MESSAGES).find(
        ([key]) => message.startsWith(key)
    )

    return prefixMatch?.[1] ?? null
}

export function getSupabaseAuthErrorMessage(
    error: SupabaseLikeError,
    fallback = "인증 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
): string {
    if (!error) {
        return fallback
    }

    if (error.code && AUTH_ERROR_CODE_MESSAGES[error.code]) {
        return AUTH_ERROR_CODE_MESSAGES[error.code] ?? fallback
    }

    const messageFromText = getMessageFromText(error.message)

    if (messageFromText) {
        return messageFromText
    }

    return fallback
}

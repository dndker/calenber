type SupabaseLikeError =
    | {
          code?: string | null
          message?: string | null
          status?: number
          name?: string
      }
    | null
    | undefined

export type AuthErrorKey =
    | "generic"
    | "signInFailed"
    | "signUpFailed"
    | "resendFailed"
    | "signOutFailed"
    | "googleFailed"
    | "callbackMissingCode"
    | "callbackFailed"
    | "anonymousProviderDisabled"
    | "badCodeVerifier"
    | "badJson"
    | "badJwt"
    | "badOauthCallback"
    | "badOauthState"
    | "emailExists"
    | "emailNotConfirmed"
    | "emailProviderDisabled"
    | "flowStateExpired"
    | "flowStateNotFound"
    | "hookPayloadInvalidContentType"
    | "hookPayloadOverSizeLimit"
    | "hookTimeout"
    | "hookTimeoutAfterRetry"
    | "identityAlreadyExists"
    | "identityNotFound"
    | "insufficientAal"
    | "invalidCredentials"
    | "inviteNotFound"
    | "manualLinkingDisabled"
    | "mfaChallengeExpired"
    | "mfaFactorNameConflict"
    | "mfaFactorNotFound"
    | "mfaIpAddressMismatch"
    | "mfaPhoneEnrollNotEnabled"
    | "mfaPhoneVerifyNotEnabled"
    | "mfaTotpEnrollNotEnabled"
    | "mfaTotpVerifyNotEnabled"
    | "mfaVerificationFailed"
    | "mfaVerificationRejected"
    | "mfaVerifiedFactorExists"
    | "mfaWebAuthnEnrollNotEnabled"
    | "mfaWebAuthnVerifyNotEnabled"
    | "noAuthorization"
    | "notAdmin"
    | "oauthProviderNotSupported"
    | "otpDisabled"
    | "otpExpired"
    | "overEmailSendRateLimit"
    | "overRequestRateLimit"
    | "overSmsSendRateLimit"
    | "phoneExists"
    | "phoneNotConfirmed"
    | "phoneProviderDisabled"
    | "pkceCodeVerifierNotFound"
    | "providerDisabled"
    | "providerEmailNeedsVerification"
    | "reauthenticationNeeded"
    | "reauthenticationNotValid"
    | "refreshTokenAlreadyUsed"
    | "refreshTokenNotFound"
    | "requestTimeout"
    | "samePassword"
    | "samlAssertionNoEmail"
    | "samlAssertionNoUserId"
    | "samlEntityIdMismatch"
    | "samlIdpAlreadyExists"
    | "samlIdpNotFound"
    | "samlMetadataFetchFailed"
    | "samlProviderDisabled"
    | "samlRelayStateExpired"
    | "samlRelayStateNotFound"
    | "sessionExpired"
    | "sessionNotFound"
    | "signupDisabled"
    | "singleIdentityNotDeletable"
    | "smsSendFailed"
    | "ssoDomainAlreadyExists"
    | "ssoProviderNotFound"
    | "tooManyEnrolledMfaFactors"
    | "unexpectedAudience"
    | "unexpectedFailure"
    | "userAlreadyExists"
    | "userBanned"
    | "userNotFound"
    | "userSsoManaged"
    | "validationFailed"
    | "weakPassword"
    | "invalidLoginCredentials"
    | "emailRateLimitExceeded"
    | "emailLinkInvalidOrExpired"
    | "tokenExpiredOrInvalid"
    | "signupRequiresValidPassword"
    | "passwordAtLeastSix"
    | "invalidEmailFormat"
    | "securityRetryLater"

const AUTH_ERROR_CODE_KEYS: Record<string, AuthErrorKey> = {
    anonymous_provider_disabled: "anonymousProviderDisabled",
    bad_code_verifier: "badCodeVerifier",
    bad_json: "badJson",
    bad_jwt: "badJwt",
    bad_oauth_callback: "badOauthCallback",
    bad_oauth_state: "badOauthState",
    email_exists: "emailExists",
    email_not_confirmed: "emailNotConfirmed",
    email_provider_disabled: "emailProviderDisabled",
    flow_state_expired: "flowStateExpired",
    flow_state_not_found: "flowStateNotFound",
    hook_payload_invalid_content_type: "hookPayloadInvalidContentType",
    hook_payload_over_size_limit: "hookPayloadOverSizeLimit",
    hook_timeout: "hookTimeout",
    hook_timeout_after_retry: "hookTimeoutAfterRetry",
    identity_already_exists: "identityAlreadyExists",
    identity_not_found: "identityNotFound",
    insufficient_aal: "insufficientAal",
    invalid_credentials: "invalidCredentials",
    invite_not_found: "inviteNotFound",
    manual_linking_disabled: "manualLinkingDisabled",
    mfa_challenge_expired: "mfaChallengeExpired",
    mfa_factor_name_conflict: "mfaFactorNameConflict",
    mfa_factor_not_found: "mfaFactorNotFound",
    mfa_ip_address_mismatch: "mfaIpAddressMismatch",
    mfa_phone_enroll_not_enabled: "mfaPhoneEnrollNotEnabled",
    mfa_phone_verify_not_enabled: "mfaPhoneVerifyNotEnabled",
    mfa_totp_enroll_not_enabled: "mfaTotpEnrollNotEnabled",
    mfa_totp_verify_not_enabled: "mfaTotpVerifyNotEnabled",
    mfa_verification_failed: "mfaVerificationFailed",
    mfa_verification_rejected: "mfaVerificationRejected",
    mfa_verified_factor_exists: "mfaVerifiedFactorExists",
    mfa_web_authn_enroll_not_enabled: "mfaWebAuthnEnrollNotEnabled",
    mfa_web_authn_verify_not_enabled: "mfaWebAuthnVerifyNotEnabled",
    no_authorization: "noAuthorization",
    not_admin: "notAdmin",
    oauth_provider_not_supported: "oauthProviderNotSupported",
    otp_disabled: "otpDisabled",
    otp_expired: "otpExpired",
    over_email_send_rate_limit: "overEmailSendRateLimit",
    over_request_rate_limit: "overRequestRateLimit",
    over_sms_send_rate_limit: "overSmsSendRateLimit",
    phone_exists: "phoneExists",
    phone_not_confirmed: "phoneNotConfirmed",
    phone_provider_disabled: "phoneProviderDisabled",
    pkce_code_verifier_not_found: "pkceCodeVerifierNotFound",
    provider_disabled: "providerDisabled",
    provider_email_needs_verification: "providerEmailNeedsVerification",
    reauthentication_needed: "reauthenticationNeeded",
    reauthentication_not_valid: "reauthenticationNotValid",
    refresh_token_already_used: "refreshTokenAlreadyUsed",
    refresh_token_not_found: "refreshTokenNotFound",
    request_timeout: "requestTimeout",
    same_password: "samePassword",
    saml_assertion_no_email: "samlAssertionNoEmail",
    saml_assertion_no_user_id: "samlAssertionNoUserId",
    saml_entity_id_mismatch: "samlEntityIdMismatch",
    saml_idp_already_exists: "samlIdpAlreadyExists",
    saml_idp_not_found: "samlIdpNotFound",
    saml_metadata_fetch_failed: "samlMetadataFetchFailed",
    saml_provider_disabled: "samlProviderDisabled",
    saml_relay_state_expired: "samlRelayStateExpired",
    saml_relay_state_not_found: "samlRelayStateNotFound",
    session_expired: "sessionExpired",
    session_not_found: "sessionNotFound",
    signup_disabled: "signupDisabled",
    single_identity_not_deletable: "singleIdentityNotDeletable",
    sms_send_failed: "smsSendFailed",
    sso_domain_already_exists: "ssoDomainAlreadyExists",
    sso_provider_not_found: "ssoProviderNotFound",
    too_many_enrolled_mfa_factors: "tooManyEnrolledMfaFactors",
    unexpected_audience: "unexpectedAudience",
    unexpected_failure: "unexpectedFailure",
    user_already_exists: "userAlreadyExists",
    user_banned: "userBanned",
    user_not_found: "userNotFound",
    user_sso_managed: "userSsoManaged",
    validation_failed: "validationFailed",
    weak_password: "weakPassword",
}

const AUTH_ERROR_MESSAGE_KEYS: Record<string, AuthErrorKey> = {
    "Invalid login credentials": "invalidLoginCredentials",
    "Email not confirmed": "emailNotConfirmed",
    "User already registered": "emailExists",
    "Invalid email or password": "invalidCredentials",
    "Email rate limit exceeded": "emailRateLimitExceeded",
    "Email link is invalid or has expired": "emailLinkInvalidOrExpired",
    "Token has expired or is invalid": "tokenExpiredOrInvalid",
    "Signup requires a valid password": "signupRequiresValidPassword",
    "Password should be at least 6 characters": "passwordAtLeastSix",
    "Unable to validate email address: invalid format": "invalidEmailFormat",
    "For security purposes, you can only request this after":
        "securityRetryLater",
}

function getKeyFromText(message: string | null | undefined) {
    if (!message) {
        return null
    }

    const exactMatch = AUTH_ERROR_MESSAGE_KEYS[message]

    if (exactMatch) {
        return exactMatch
    }

    const prefixMatch = Object.entries(AUTH_ERROR_MESSAGE_KEYS).find(
        ([key]) => message.startsWith(key)
    )

    return prefixMatch?.[1] ?? null
}

export function getSupabaseAuthErrorKey(
    error: SupabaseLikeError,
    fallback: AuthErrorKey = "generic"
): AuthErrorKey {
    if (!error) {
        return fallback
    }

    if (error.code && AUTH_ERROR_CODE_KEYS[error.code]) {
        return AUTH_ERROR_CODE_KEYS[error.code] ?? fallback
    }

    const messageKey = getKeyFromText(error.message)

    if (messageKey) {
        return messageKey
    }

    return fallback
}

export function getSupabaseAuthErrorMessage(
    error: SupabaseLikeError,
    t: (key: AuthErrorKey) => string,
    fallback: AuthErrorKey = "generic"
): string {
    return t(getSupabaseAuthErrorKey(error, fallback))
}

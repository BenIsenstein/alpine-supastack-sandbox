import '@unocss/reset/tailwind-compat.css'
import 'virtual:uno.css'
import { I18nVariables, merge, VIEWS, en, ViewType, ProviderScopes, OtpType, template } from '@supabase/auth-ui-shared'
import { AuthError, Session, SupabaseClient, User, createClient, Provider } from "@supabase/supabase-js"
import Alpine from 'alpinejs'

window.__supabase_auth_ui_shared = {
    template,
    capitalize: (word: string) => word.charAt(0).toUpperCase() + word.toLowerCase().slice(1),
    providerIconClasses: {
        
    }
}

type SupabaseAuthResponseLike = { error: AuthError | null, [key: string]: unknown }

type AuthProps = {
    providers?: Provider[]
    providerScopes?: Partial<ProviderScopes>
    queryParams?: Record<string, string>
    view: ViewType
    redirectTo?: string | undefined
    onlyThirdPartyProviders?: boolean
    magicLink?: boolean
    showLinks?: boolean
    otpType?: OtpType
    additionalData?: Record<string, unknown>
    // Override the labels and button text
    localization?: {
      variables?: I18nVariables
    }
}

type InputProps = {
    id: string
    type: string
    autoFocus?: boolean
    label: string
    placeholder: string
    autoComplete?: string
    onChange: (str: string) => void
}

const supabase = createClient(import.meta.env.VITE_SUPABASE_API_URL, import.meta.env.VITE_SUPABASE_API_KEY)

Alpine.store('app', {
    supabase,
    session: null,
    get user() {
        return this.session?.user ?? null
    },
    error: null,
    async withCaptureAuthError<T extends SupabaseAuthResponseLike>(cb: () => Promise<T>): Promise<T> {
        this.error = null
        const result = await cb()
        if (result.error) {
            this.error = result.error
        }
        return result
    },
    init() {
        supabase.auth.onAuthStateChange(async (_, session) => { this.session = session })
        this.withCaptureAuthError = this.withCaptureAuthError.bind(this)
    }
})

Alpine.store('authView', {
    views: [
        { id: 'sign_in', title: 'Sign In' },
        { id: 'sign_up', title: 'Sign Up' },
        { id: 'magic_link', title: 'Magic Link' },
        { id: 'forgotten_password', title: 'Forgotten Password' },
        { id: 'update_password', title: 'Update Password' },
        { id: 'verify_otp', title: 'Verify Otp' },
    ],
    view: 'sign_in'
})

Alpine.data('authUI', (setupProps: AuthProps) => {
    const { localization, otpType, redirectTo, providers, providerScopes, queryParams, additionalData, magicLink, onlyThirdPartyProviders, showLinks } = setupProps

    return {
        showLinks: showLinks ?? true,
        isMounted: false,
        providers,
        providerScopes,
        onlyThirdPartyProviders,
        email: '',
        password: '',
        phone: '',
        token: '',
        message: '',
        loading: false,
        i18n: merge(en, localization?.variables ?? {}),
        get isSignView() {
            const view = Alpine.store('authView').view
            return view === 'sign_in' || view === 'sign_up' || view === 'magic_link'
        },
        get isPhone() {
            return otpType === 'sms' || otpType === 'phone_change'
        },
        get labels() {
            return this.i18n?.[Alpine.store('authView').view]
        },
        get inputs() {
            const inputs: InputProps[] = []
            const view = Alpine.store('authView').view

            if (this.isSignView || view === VIEWS.FORGOTTEN_PASSWORD || (view === VIEWS.VERIFY_OTP && !this.isPhone)) {
                inputs.push({
                    id: "email",
                    type: "email",
                    autoFocus: true,
                    placeholder: this.labels?.email_input_placeholder,
                    label: (view === VIEWS.MAGIC_LINK  || view === VIEWS.VERIFY_OTP) ? this.labels?.email_input_label : this.labels?.email_label,
                    onChange: (val) => { this.email = val }
                })
            }
            if (view === VIEWS.SIGN_IN || view === VIEWS.SIGN_UP || view === VIEWS.UPDATE_PASSWORD) {
                inputs.push({
                    id: "password",
                    type: "password",
                    label: this.labels?.password_label,
                    placeholder: view === VIEWS.UPDATE_PASSWORD ? this.labels?.password_label : this.labels?.password_input_placeholder,
                    autoFocus: view === VIEWS.UPDATE_PASSWORD || undefined,
                    onChange: (val) => { this.password = val },
                    autoComplete: view === 'sign_in' ? 'current-password' : 'new-password'
                })
            }
            if (view === VIEWS.VERIFY_OTP && this.isPhone) {
                inputs.push({
                    id: "phone",
                    type: "text",
                    label: this.labels?.phone_input_label,
                    autoFocus: true,
                    placeholder: this.labels?.phone_input_placeholder,
                    onChange: (val) => { this.phone = val }
                })
            }
            if (view === VIEWS.VERIFY_OTP) {
                inputs.push({
                    id: "token",
                    type: "text",
                    label: this.labels?.token_input_label,
                    placeholder: this.labels?.token_input_placeholder,
                    onChange: (val) => { this.token = val }
                })
            }

            return inputs
        },
        get links() {
            const links: ViewType[] = []
            const view = Alpine.store('authView').view

            if (this.isSignView) {
                links.push(view !== VIEWS.SIGN_IN ? VIEWS.SIGN_IN : VIEWS.SIGN_UP)
            }
            if (view === VIEWS.SIGN_IN) {
                links.push(VIEWS.FORGOTTEN_PASSWORD)
            }
            if (view === VIEWS.SIGN_IN && magicLink) {
                links.push(VIEWS.MAGIC_LINK)
            }
            if (view === VIEWS.FORGOTTEN_PASSWORD || view === VIEWS.VERIFY_OTP) {
                links.push(VIEWS.SIGN_IN)
            }
            if (view === VIEWS.UPDATE_PASSWORD) {
                links.push(VIEWS.SIGN_UP)
            }

            return links
        },
        async handleProviderSignIn(provider) {
            this.loading = true

            await Alpine.store('app').withCaptureAuthError(() => Alpine.store('app').supabase.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo,
                    scopes: providerScopes?.[provider],
                    queryParams
                }
            }))

            this.loading = false
        },
        async handleSubmit(e) {
            e.preventDefault()
            this.loading = true
            this.message = ''
            const view = Alpine.store('authView').view
            const withCaptureAuthError = Alpine.store('app').withCaptureAuthError
            const auth = Alpine.store('app').supabase.auth

            if (view === VIEWS.SIGN_IN) {
                await withCaptureAuthError(() => auth.signInWithPassword({
                    email: this.email,
                    password: this.password
                }))
            }
            if (view === VIEWS.SIGN_UP) {
                const { data: { user, session }} = await withCaptureAuthError(() => auth.signUp({
                    email: this.email,
                    password: this.password,
                    options: {
                    emailRedirectTo: redirectTo,
                    data: additionalData
                    }
                }))

                // Check if session is null -> email confirmation setting is turned on
                if (user && !session) {
                    this.message = this.i18n?.sign_up?.confirmation_text
                }
            }
            if (view === VIEWS.FORGOTTEN_PASSWORD) {
                const { error } = await withCaptureAuthError(() => auth.resetPasswordForEmail(
                    this.email,
                    {
                    redirectTo
                    }
                ))

                if (!error) {
                    this.message = this.i18n?.forgotten_password?.confirmation_text
                }
            }
            if (view === VIEWS.MAGIC_LINK) {
                const { error } = await withCaptureAuthError(() => auth.signInWithOtp({
                    email: this.email,
                    options: {
                    emailRedirectTo: redirectTo
                    }
                }))

                if (!error) {
                    this.message = this.i18n?.magic_link?.confirmation_text
                }
            }
            if (view === VIEWS.UPDATE_PASSWORD) {
                const { error } = await withCaptureAuthError(() => auth.updateUser({ password: this.password }))

                if (!error) {
                    this.message = this.i18n?.update_password?.confirmation_text
                }
            }
            if (view === VIEWS.VERIFY_OTP) {
                const { phone, email, token } = this
                await withCaptureAuthError(() => auth.verifyOtp(
                    this.isPhone
                    ? { phone, token, type: otpType }
                    : { email, token, type: otpType }
                ))
            }

            if (this.isMounted) this.loading = false
        },
        listener: undefined,
        init() {
            this.isMounted = true
            // Overrides the authview if it is changed externally
            this.listener = Alpine.store('app').supabase.auth.onAuthStateChange((event) => {
                if (event === 'PASSWORD_RECOVERY') {
                    Alpine.store('authView').view = 'update_password'
                } else if (event === 'USER_UPDATED' || event === 'SIGNED_OUT') {
                    Alpine.store('authView').view = 'sign_in'
                }
            })
        },
        destroy() {
            this.isMounted = false
            this.listener.data.subscription.unsubscribe()
        }
    }
})

Alpine.start()
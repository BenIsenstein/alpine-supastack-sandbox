import '@unocss/reset/tailwind-compat.css'
import 'virtual:uno.css'
import { I18nVariables, merge, VIEWS, en, ViewType, ProviderScopes, OtpType, template } from '@supabase/auth-ui-shared'
import { AuthError, Session, SupabaseClient, User, createClient, Provider, MobileOtpType, EmailOtpType } from "@supabase/supabase-js"
import Alpine from 'alpinejs'

declare global {
    interface Window {
        __supabase_auth_ui_shared: {
            template: (string: string, data: Record<string, string>) => string
            capitalize: (work: string) => string
            providerIconClasses: Object
        }
    }
}

declare module 'alpinejs' {
    interface Stores {
        authView: {
            view: ViewType,
            views: { id: ViewType, title: string }[]
        }
        app: TAppStore
    }
}

window.__supabase_auth_ui_shared = {
    template,
    capitalize: (word: string) => word.charAt(0).toUpperCase() + word.toLowerCase().slice(1),
    providerIconClasses: {
        google: 'i-logos:google-icon',
        facebook: 'i-logos:facebook',
        notion: 'i-logos:notion-icon',
        gitlab: 'i-logos:gitlab',
        apple: 'i-logos:apple',
        azure: 'i-logos:microsoft-azure',
        bitbucket: 'i-logos:bitbucket',
        discord: 'i-logos:discord',
        github: 'i-logos:github-icon',
        linkedin: 'i-logos:linkedin-icon',
        slack: 'i-logos:slack-icon',
        spotify: 'i-logos:spotify-icon',
        twitch: 'i-logos:twitch',
        twitter: 'i-logos:twitter',
        workos: 'i-logos:workos-icon',
    },
}

type SupabaseAuthResponseLike = { error: AuthError | null, [key: string]: unknown }

type WithCaptureAuthError = <T extends SupabaseAuthResponseLike>(cb: () => Promise<T>) => Promise<T>

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

type TAppStore = {
    supabase: SupabaseClient
    session: Session | null
    user: User | null
    error: AuthError | null
    withCaptureAuthError: WithCaptureAuthError
    init: () => void
}

const appStore: TAppStore = {
    supabase: createClient(import.meta.env.VITE_SUPABASE_API_URL, import.meta.env.VITE_SUPABASE_API_KEY),
    session: null,
    get user() {
        return this.session?.user ?? null
    },
    error: null,
    async withCaptureAuthError(cb) {
        this.error = null
        const result = await cb()
        if (result.error) {
            this.error = result.error
        }
        return result
    },
    init() {
        this.supabase.auth.onAuthStateChange(async (_, session) => { this.session = session })
        this.withCaptureAuthError = this.withCaptureAuthError.bind(this)
    }
}

Alpine.store('app', appStore)

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
        i18n: merge(en, localization?.variables ?? {}) as { [key in keyof typeof en]: typeof en[key] & { [key: string]: string } },
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
        async handleProviderSignIn(provider: Provider) {
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
        async handleSubmit(e: Event) {
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
                    ? { phone, token, type: otpType as MobileOtpType }
                    : { email, token, type: otpType as EmailOtpType }
                ))
            }

            if (this.isMounted) this.loading = false
        },
        listener: undefined as undefined | ReturnType<SupabaseClient['auth']['onAuthStateChange']>,
        init() {
            this.$el.innerHTML = `
                <div x-show="isSignView && providers && providers.length > 0" class="flex flex-col gap-2">
                    <div class="flex flex-col gap-2 my-2">
                        <template x-for="provider in providers" :key="provider">
                        <button :disabled="loading" @click="handleProviderSignIn(provider)" class="flex justify-center items-center gap-2 rounded-md text-sm p-1 cursor-pointer border-[1px] border-zinc-950 w-full disabled:opacity-70 disabled:cursor-[unset] bg-transparent text-black hover:bg-stone-100">
                            <span x-text="window.__supabase_auth_ui_shared.template(i18n?.[$store.authView.view === 'magic_link' ? 'sign_in' : $store.authView.view]?.social_provider_text, { provider: window.__supabase_auth_ui_shared.capitalize(provider) })"></span>
                            <span :class="window.__supabase_auth_ui_shared.providerIconClasses[provider]"></span>
                        </button>
                        </template>
                    </div>
                    <div x-show="!onlyThirdPartyProviders" class="block my-4 h-[1px] w-full"></div>
                </div>
                <div x-show="!onlyThirdPartyProviders" class="flex flex-col gap-2">
                    <form :id="$store.authView.view" @submit="handleSubmit" autoComplete class="flex flex-col gap-2 my-2">
                        <template x-for="input in inputs" :key="input.id">
                        <div>
                            <label :for="input.id" x-text="input.label" class="text-sm mb-1 text-black block"></label>
                            <input :id="input.id" :name="input.id" :type="input.type" :autofocus="input.autoFocus" :autocomplete="input.autoComplete" :placeholder="input.placeholder" @change="input.onChange($event.target.value)" class="py-1 px-2 cursor-text border-[1px] border-solid border-black text-s w-full text-black box-border hover:[outline:none] focus:[outline:none]">
                        </div>
                        </template>
                        <button type="submit" :disabled="loading" x-text="loading ? labels?.loading_button_label : labels?.button_label" class="flex justify-center items-center rounded-md text-sm p-1 cursor-pointer border-[1px] border-zinc-950 w-full mt-2 disabled:opacity-70 disabled:cursor-[unset] bg-amber-200 text-amber-950 hover:bg-amber-300"></button>
                        <div x-show="showLinks" class="flex flex-col gap-3 my-2">
                        <template x-for="v in links" :key="v">
                            <a x-text="i18n?.[v]?.link_text" :href="\`#\${v}\`" @click.prevent="$store.authView.view = v" class="block text-xs text-center underline hover:text-blue-700"></a>
                        </template>
                        </div>
                    </form>
                </div>
                <span x-show="!!message" x-text="message" class="block text-center text-xs mb-1 rounded-md py-6 px-4 border-[1px] border-black"></span>
                <span x-show="!!$store.app.error" x-text="$store.app.error?.message" class="block text-center text-xs mb-1 rounded-md py-6 px-4 border-[1px] text-red-900 bg-red-100 border-red-950"></span>
            `
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
            this.listener!.data.subscription.unsubscribe()
        }
    }
})

Alpine.start()
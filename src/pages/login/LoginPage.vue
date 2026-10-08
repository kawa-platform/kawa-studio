<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ApiError } from '@/api/error';
import { submitLogin } from '@/api/oauth';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import { safeRedirect, validateLogin } from './lib/login';

/// kawa studio's login page, used as the login UI of the gateway's (headless) authorization server:
/// `/oauth/authorize` redirects here with a `login_challenge`. Without one, the page starts the login
/// flow itself, so `/login` can be opened directly.
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
// The app shell (and with it the sidebar that normally loads the theme preference) is not
// rendered here, so load the operator's light/dark choice explicitly.
useUiStore();

const FEATURES = [
    { icon: 'ph-tree-structure', title: 'Virtual topics', text: 'Stable, application-level names mapped onto physical topics.' },
    { icon: 'ph-shield-check', title: 'Access control', text: 'SASL clients, roles and groups, enforced on every request.' },
    { icon: 'ph-scales', title: 'Governance', text: 'Policies checked before a topic ever reaches the cluster.' },
];

const username = ref('');
const password = ref('');
const errors = ref<Record<string, string>>({});
const serverError = ref<string | null>(null);
const pending = ref(false);
const challengeExpired = ref(false);
/// Replaces the challenge from the URL once it has been renewed.
const renewedChallenge = ref<string | null>(null);
const loginChallenge = computed(() => renewedChallenge.value
    ?? (typeof route.query.login_challenge === 'string' ? route.query.login_challenge : null));

/// Where to go once logged in.
const returnTo = (): string => auth.pendingReturnTo() ?? safeRedirect(route.query.redirect);

/// Starts (or restarts) the login flow, returning to where the user was headed.
const startOver = (): void => {
    void auth.beginLogin(returnTo());
};

/// Logs in for the pending authorization request. If its challenge has expired (the page was left
/// open, or the gateway restarted), fetches a fresh one in the background and logs in with that, so
/// the user does not have to start over. Only when that fails too does the error reach the user.
const login = async (user: string, secret: string): Promise<string> => {
    try {
        return await submitLogin(loginChallenge.value ?? '', user, secret);
    } catch (cause) {
        if (!(cause instanceof ApiError && cause.code === 'invalid_challenge')) throw cause;
        const fresh = await auth.renewLogin(returnTo());
        renewedChallenge.value = fresh;
        void router.replace({ query: { ...route.query, login_challenge: fresh } });
        return await submitLogin(fresh, user, secret);
    }
};

onMounted(() => {
    if (!loginChallenge.value) startOver();
});

/// Submits the form; the gateway answers with where to send the browser next: the callback, with an
/// authorization code.
const submit = async (): Promise<void> => {
    serverError.value = null;
    const found = validateLogin({ username: username.value, password: password.value });
    errors.value = found;
    if (Object.keys(found).length > 0 || !loginChallenge.value) return;
    pending.value = true;
    try {
        window.location.assign(await login(username.value.trim(), password.value));
    } catch (cause) {
        serverError.value = cause instanceof ApiError ? cause.message : 'Sign-in failed.';
        challengeExpired.value = cause instanceof ApiError && cause.code === 'invalid_challenge';
        password.value = '';
        pending.value = false;
    }
};
</script>

<template>
    <div class="login">
        <aside class="intro">
            <div class="brand-row">
                <span class="mark" aria-hidden="true">川</span>
                <span class="wordmark">kawa</span>
            </div>
            <p class="kicker">Kafka Gateway</p>

            <h1 class="tagline">A high-performance, application-level gateway for Apache&nbsp;Kafka.</h1>
            <p class="pitch">
                Higher-level abstractions for your clusters: kawa sits between applications and brokers and
                enforces them on the wire, without changes to a broker or a client library.
            </p>

            <ul class="features">
                <li v-for="feature in FEATURES" :key="feature.title">
                    <i :class="['ph-duotone', feature.icon]" />
                    <div>
                        <strong>{{ feature.title }}</strong>
                        <span>{{ feature.text }}</span>
                    </div>
                </li>
            </ul>

            <!-- 川 is "river": three currents flowing under the panel. -->
            <svg class="river" viewBox="0 0 600 160" preserveAspectRatio="none" aria-hidden="true">
                <path d="M0 40 C 120 10, 220 70, 340 40 S 520 10, 600 34" />
                <path d="M0 82 C 140 52, 240 112, 360 82 S 520 52, 600 76" />
                <path d="M0 124 C 110 94, 230 154, 350 124 S 530 94, 600 118" />
            </svg>
        </aside>

        <main class="panel">
            <p v-if="!loginChallenge" class="card redirecting">Redirecting to sign in…</p>
            <form v-else class="form card" novalidate @submit.prevent="submit">
                <div class="card-head">
                    <h2>Sign in</h2>
                    <p>Use your kawa account to manage topics, clients and access.</p>
                </div>

                <div class="field">
                    <label for="username">Username</label>
                    <input id="username" v-model="username" class="input mono" autocomplete="username" autofocus>
                    <p v-if="errors.username" class="field-error">{{ errors.username }}</p>
                </div>
                <div class="field">
                    <label for="password">Password</label>
                    <input id="password" v-model="password" class="input" type="password" autocomplete="current-password">
                    <p v-if="errors.password" class="field-error">{{ errors.password }}</p>
                </div>

                <button type="submit" class="btn btn-primary submit" :disabled="pending">
                    <i class="ph-duotone ph-sign-in" />
                    {{ pending ? 'Signing in…' : 'Sign in' }}
                </button>

                <p v-if="serverError" class="error" role="alert">{{ serverError }}</p>
                <button v-if="challengeExpired" type="button" class="btn btn-secondary submit" @click="startOver">
                    Start again
                </button>
            </form>
        </main>
    </div>
</template>

<style scoped>
.login {
    min-height: 100vh;
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(380px, 1fr);
    background: var(--color-bg);
}

/* ── Brand panel ── */
.intro {
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 56px clamp(32px, 6vw, 88px) 140px;
    background:
        radial-gradient(120% 80% at 0% 0%, color-mix(in srgb, var(--brand) 14%, transparent), transparent 60%),
        var(--chrome);
    border-right: 1px solid var(--chrome-line);
}

.brand-row { display: flex; align-items: center; gap: 12px; }

.mark {
    width: 44px;
    height: 44px;
    flex: none;
    display: grid;
    place-items: center;
    border-radius: 5px;
    background: var(--brand);
    color: var(--on-brand);
    font-size: 27px;
    font-weight: 600;
    box-shadow: 0 8px 24px color-mix(in srgb, var(--brand) 28%, transparent);
}

.wordmark { font-family: var(--font-heading); font-size: 26px; font-weight: 600; letter-spacing: -0.01em; }

.kicker {
    margin: 14px 0 0;
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--brand-text);
}

.tagline {
    max-width: 560px;
    margin: 40px 0 0;
    font-family: var(--font-heading);
    font-size: clamp(28px, 3.2vw, 40px);
    font-weight: 600;
    line-height: 1.15;
    letter-spacing: -0.02em;
}

.pitch { max-width: 520px; margin: 18px 0 0; font-size: 15px; line-height: 1.6; color: var(--muted); }

.features { display: grid; gap: 16px; max-width: 520px; margin: 36px 0 0; padding: 0; list-style: none; }
.features li { display: flex; gap: 14px; align-items: flex-start; }
.features i { flex: none; margin-top: 1px; font-size: 22px; color: var(--brand-text); }
.features strong { display: block; font-size: 14px; }
.features span { display: block; margin-top: 2px; font-size: 13px; color: var(--muted); }

.river {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 120px;
    fill: none;
    stroke: var(--brand);
    stroke-width: 1.5;
    stroke-linecap: round;
    opacity: 0.35;
}

/* ── Sign-in card ── */
.panel { display: grid; place-items: center; padding: 40px 24px; }

.card {
    width: min(380px, 100%);
    padding: 32px 30px 28px;
    border: 1px solid var(--color-divider);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    box-shadow: 0 18px 50px color-mix(in srgb, var(--color-text) 8%, transparent);
}

.card-head h2 { margin: 0; font-family: var(--font-heading); font-size: 22px; font-weight: 600; }
.card-head p { margin: 6px 0 24px; font-size: 13px; line-height: 1.5; color: var(--muted); }

.submit { width: 100%; justify-content: center; margin-top: 6px; }
.redirecting { font-size: 13px; color: var(--muted); text-align: center; }

@media (max-width: 860px) {
    .login { grid-template-columns: 1fr; }
    .intro { padding: 36px 24px 72px; border-right: none; border-bottom: 1px solid var(--chrome-line); }
    .tagline { margin-top: 24px; font-size: 24px; }
    .features { display: none; }
    .river { height: 56px; }
}
</style>

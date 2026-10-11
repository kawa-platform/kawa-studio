<script setup lang="ts">
import { computed, ref } from 'vue';
import { SwitchRoot, SwitchThumb } from 'reka-ui';
import { ApiError } from '@/api/error';
import AppToast from '@/components/AppToast.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import { toModuleCards, type ModuleCard } from './lib/modules';
import { useModules, useUpdateModule } from './queries';

const { data } = useModules();
const cards = computed(() => toModuleCards(data.value ?? []));

const counts = computed(() => ({
    enabled: cards.value.filter((card) => card.enabled).length,
    disabled: cards.value.filter((card) => !card.enabled).length,
}));

const target = ref<ModuleCard | null>(null);
const typed = ref('');
const typedError = ref<string | null>(null);
/// The gateway's refusal of the last switch, shown in the dialog, which stays open.
const saveError = ref<string | null>(null);
const updateModule = useUpdateModule();
const pending = ref(false);

const turningOff = computed(() => target.value?.enabled === true);
/// Switching access control off is the one change that needs the identifier typed back.
const needsTypedConfirmation = computed(() => turningOff.value && target.value?.id === 'rbac');

const dialogOpen = computed({
    get: () => target.value !== null,
    set: (open: boolean) => { if (!open) target.value = null; },
});

const askToggle = (card: ModuleCard): void => {
    target.value = card;
    typed.value = '';
    typedError.value = null;
    saveError.value = null;
};

const dialogTitle = computed(() => target.value
    ? `${turningOff.value ? 'Disable' : 'Enable'} ${target.value.name.toLowerCase()}?`
    : '');

const dialogBody = computed(() => {
    if (!target.value) return '';
    return turningOff.value
        ? 'Applies to every gateway replica within seconds. Its configuration is kept, so enabling it again restores it as it was.'
        : 'Applies to every gateway replica within seconds, using the configuration the module had when it was switched off.';
});

const toast = ref<{ ok: boolean; text: string } | null>(null);
const toastOpen = computed({
    get: () => toast.value !== null,
    set: (open: boolean) => { if (!open) toast.value = null; },
});

/// Sends `PUT /modules/{id}`; the card only changes once the gateway accepted it.
const confirmToggle = async (): Promise<void> => {
    const card = target.value;
    if (!card || pending.value) return;
    if (needsTypedConfirmation.value && typed.value.trim() !== card.id) {
        typedError.value = `Type ${card.id} to confirm.`;
        return;
    }
    const enabled = !card.enabled;
    pending.value = true;
    saveError.value = null;
    try {
        await updateModule.mutateAsync({ id: card.id, body: { enabled } });
        toast.value = { ok: true, text: `${card.name} ${enabled ? 'enabled' : 'disabled'} on every replica.` };
        target.value = null;
    } catch (cause) {
        saveError.value = cause instanceof ApiError ? cause.message : 'The gateway did not accept the change.';
    } finally {
        pending.value = false;
    }
};
</script>

<template>
    <div>
        <div class="head">
            <div>
                <h1>Gateway modules</h1>
                <p class="lede">
                    Gateway features are divided into modules. Each module can be enabled or disabled independently.
                </p>
            </div>
        </div>

        <div class="stat-strip summary">
            <div class="stat">
                <div class="stat-label">Enabled</div>
                <div class="stat-value">{{ counts.enabled }}</div>
            </div>
            <div class="stat">
                <div class="stat-label">Disabled</div>
                <div class="stat-value">{{ counts.disabled }}</div>
            </div>
        </div>

        <div class="grid">
            <article
                v-for="module in cards"
                :key="module.id"
                class="module"
                :class="{ 'module-disabled': !module.enabled }"
            >
                <header class="module-head">
                    <span class="module-icon"><i :class="['ph-duotone', module.icon]" /></span>
                    <div class="module-title">
                        <h2>{{ module.name }}</h2>
                        <span class="module-id mono">{{ module.id }}</span>
                    </div>
                    <SwitchRoot
                        class="switch-root module-switch"
                        :model-value="module.enabled"
                        :aria-label="`${module.enabled ? 'Disable' : 'Enable'} ${module.name}`"
                        @update:model-value="askToggle(module)"
                    >
                        <SwitchThumb class="switch-thumb" />
                    </SwitchRoot>
                </header>

                <p class="module-desc">{{ module.description }}</p>

                <div v-if="module.caution" class="caution" role="note">
                    <i class="ph-duotone ph-warning" />
                    <span>{{ module.caution }}</span>
                </div>

                <dl class="gates">
                    <div class="gate">
                        <dt><i class="ph-duotone ph-plugs-connected" />Kafka path</dt>
                        <dd>{{ module.kafka }}</dd>
                    </div>
                    <div class="gate">
                        <dt><i class="ph-duotone ph-browser" />Studio</dt>
                        <dd class="pages">
                            <RouterLink
                                v-for="page in module.pages"
                                :key="page.to"
                                class="page-chip"
                                :class="{ 'page-chip-off': !module.enabled }"
                                :to="page.to"
                            >
                                {{ page.label }}<i class="ph-duotone ph-arrow-up-right" />
                            </RouterLink>
                        </dd>
                    </div>
                </dl>
            </article>
        </div>

        <ConfirmDialog
            v-model:open="dialogOpen"
            :title="dialogTitle"
            :body="dialogBody"
            :confirm-label="turningOff ? 'Disable module' : 'Enable module'"
            :danger="turningOff"
            :pending="pending"
            @confirm="confirmToggle"
        >
            <ul v-if="target" class="effects">
                <li>
                    <i class="ph-duotone ph-plugs-connected" />
                    <span class="effect-what">Kafka path</span>
                    <span class="effect-change" :class="{ 'effect-off': turningOff }">{{ turningOff ? 'Stops' : 'Starts' }}</span>
                    <span>{{ target.kafka }}</span>
                </li>
                <li>
                    <i class="ph-duotone ph-browser" />
                    <span class="effect-what">Studio</span>
                    <span class="effect-change" :class="{ 'effect-off': turningOff }">{{ turningOff ? 'Marked off' : 'Active' }}</span>
                    <span>
                        {{ target.pages.map((page) => page.label).join(', ') }}
                        {{ turningOff ? 'stay editable, but changes have no effect until it is enabled again' : 'take effect again' }}
                    </span>
                </li>
            </ul>

            <div v-if="target && needsTypedConfirmation" class="typed">
                <div class="caution caution-strong" role="alert">
                    <i class="ph-duotone ph-warning-octagon" />
                    <span>{{ target.caution }}</span>
                </div>
                <div class="field">
                    <label for="confirm-module">Type <span class="mono">{{ target.id }}</span> to confirm</label>
                    <input id="confirm-module" v-model="typed" class="input mono" autocomplete="off" spellcheck="false">
                    <div v-if="typedError" class="field-error">{{ typedError }}</div>
                </div>
            </div>
            <div v-if="saveError" class="caution caution-strong save-error" role="alert">
                <i class="ph-duotone ph-warning-circle" />
                <span>{{ saveError }}</span>
            </div>
        </ConfirmDialog>

        <AppToast v-model:open="toastOpen" :ok="toast?.ok ?? true" :text="toast?.text ?? ''" />
    </div>
</template>

<style scoped>
.head { display: flex; align-items: flex-end; gap: 24px; margin-bottom: 20px; }
.head > div { margin-right: auto; }

.summary { margin-bottom: 22px; max-width: 600px; }

.grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
    gap: 16px;
}

/* — module card — */
.module {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 20px 22px 18px;
    background: var(--color-surface);
    border: 1px solid var(--panel-line);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-sm);
    transition: box-shadow 160ms ease, border-color 160ms ease, translate 160ms ease;
}

.module-head { display: flex; align-items: center; gap: 14px; }
.module-icon {
    width: 46px;
    height: 46px;
    flex: none;
    display: grid;
    place-items: center;
    border-radius: 14px;
    font-size: 23px;
    color: var(--color-accent-700);
    background: var(--color-accent-100);
    transition: background 160ms ease, color 160ms ease;
}
.module-disabled .module-icon { color: var(--faint); background: color-mix(in srgb, var(--color-text) 6%, transparent); }

.module-title { display: flex; flex-direction: column; gap: 3px; min-width: 0; margin-right: auto; }
.module-title h2 { font-size: 17px; font-weight: 650; letter-spacing: -0.015em; margin: 0; }
.module-id {
    align-self: flex-start;
    font-size: 11.5px;
    color: var(--muted);
    padding: 1px 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-text) 5%, transparent);
}

/* A larger switch than the shared one: it is the card's primary action. */
.module-switch { width: 44px; height: 26px; cursor: pointer; }
.module-switch[data-state='unchecked'] {
    background: color-mix(in srgb, var(--color-text) 16%, transparent);
    border-color: transparent;
}
.module-switch :deep(.switch-thumb) { width: 18px; height: 18px; top: 3px; left: 3px; box-shadow: 0 1px 3px color-mix(in srgb, #020b18 30%, transparent); }
.module-switch[data-state='checked'] :deep(.switch-thumb) { translate: 18px 0; }
.module-switch[data-disabled] { opacity: 0.45; cursor: not-allowed; }
.module-switch:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ring); }

.module-desc { margin: 0; font-size: 14px; line-height: 1.55; color: var(--muted); }

.caution {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 10px 12px;
    font-size: 13px;
    line-height: 1.5;
    border-radius: var(--radius-md);
    color: color-mix(in srgb, var(--warning) 75%, var(--color-text));
    background: color-mix(in srgb, var(--warning) 11%, transparent);
    border: 1px solid color-mix(in srgb, var(--warning) 28%, transparent);
}
.caution i { font-size: 17px; flex: none; margin-top: 1px; color: var(--warning); }
.caution-strong {
    color: color-mix(in srgb, var(--error) 80%, var(--color-text));
    background: color-mix(in srgb, var(--error) 10%, transparent);
    border-color: color-mix(in srgb, var(--error) 28%, transparent);
}
.caution-strong i { color: var(--error); }

.gates {
    margin: auto 0 0;
    padding-top: 14px;
    border-top: 1px solid var(--chrome-line);
    display: flex;
    flex-direction: column;
    gap: 9px;
}
.gate { display: grid; grid-template-columns: 112px 1fr; gap: 12px; align-items: baseline; }
.gate dt { display: flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 500; color: var(--faint); white-space: nowrap; }
.gate dt i { font-size: 15px; }
.gate dd { margin: 0; font-size: 13px; color: var(--color-text); min-width: 0; }
.gate dd.mono { font-size: 12.5px; }

.pages { display: flex; flex-wrap: wrap; gap: 6px; }
.page-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 10px;
    font-size: 12.5px;
    font-weight: 500;
    border-radius: 999px;
    text-decoration: none;
    color: var(--color-accent-700);
    background: var(--color-accent-100);
    transition: background 140ms ease;
}
.page-chip i { font-size: 12px; }
.page-chip:hover { background: color-mix(in srgb, var(--color-accent) 22%, transparent); }
.page-chip-off { color: var(--muted); background: color-mix(in srgb, var(--color-text) 6%, transparent); }
.page-chip-off:hover { background: color-mix(in srgb, var(--color-text) 11%, transparent); }

/* — dialog — */
.effects { list-style: none; margin: 14px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; font-size: 13px; }
.effects li {
    display: grid;
    grid-template-columns: 16px 76px 84px 1fr;
    gap: 9px;
    align-items: baseline;
    color: var(--muted);
}
.effects i { font-size: 16px; align-self: center; color: var(--color-accent-700); }
.effects .mono { font-size: 12.5px; }
.effect-what { color: var(--color-text); font-weight: 600; white-space: nowrap; }
.effect-change {
    justify-self: start;
    font-size: 11.5px;
    font-weight: 600;
    padding: 1px 8px;
    border-radius: 999px;
    color: var(--success);
    background: color-mix(in srgb, var(--success) 13%, transparent);
}
.effect-change.effect-off { color: var(--error); background: color-mix(in srgb, var(--error) 11%, transparent); }
.typed { margin-top: 16px; display: flex; flex-direction: column; gap: 14px; }
.typed .field { margin: 0; }
.typed label .mono { font-weight: 600; color: var(--color-text); }
.field-error { font-size: 12px; color: var(--error); margin-top: 5px; }
.save-error { margin-top: 14px; }

@media (max-width: 520px) {
    .grid { grid-template-columns: 1fr; }
    .gate { grid-template-columns: 1fr; gap: 2px; }
}
</style>

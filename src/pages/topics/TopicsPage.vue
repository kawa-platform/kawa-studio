<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { TabsList, TabsRoot, TabsTrigger } from 'reka-ui';
import {isInternalTopic, type Topic} from '@/api/types';
import TopicTree from './components/TopicTree.vue';
import TopicDrawer from './components/TopicDrawer.vue';
import { buildRows, type TopicView } from './lib/rows';
import { useTopicView } from './useTopicView';
import {useAcls, useDeleteVirtualTopic, useTopics} from './queries';
import ConfirmDialog from "@/components/ConfirmDialog.vue";
import { SwitchRoot, SwitchThumb } from 'reka-ui'

const router = useRouter();
const view = useTopicView();
const query = ref('');
const collapsed = ref(new Set<string>());
const selected = ref<Topic | null>(null);
const drawerOpen = ref(false);

const { data: topicData, error } = useTopics();
const { data: aclData } = useAcls();

const showInternalTopics  = ref(false)
const topics = computed(() => topicData.value ?? []);
const visibleTopics = computed(() =>
    showInternalTopics.value
        ? topics.value
        : topics.value.filter((t) => !isInternalTopic(t)))
const acls = computed(() => aclData.value ?? []);

const rows = computed(() => buildRows(visibleTopics.value, view.value, query.value, collapsed.value));

const totals = computed(() => {
    const virtual = topics.value.filter((t) => t.type === 'virtual');
    const physical = topics.value.filter((t) => t.type === 'physical');
    return {
        virtual: virtual.length,
        physical: physical.length,
        filtered: virtual.filter((t) => t.filter).length,
        inView: view.value === 'virtual' ? virtual.length : view.value === 'physical' ? physical.length : topics.value.length,
    };
});

const stats = computed(() => [
    { label: 'Virtual topics', value: totals.value.virtual },
    { label: 'Physical topics', value: totals.value.physical },
    { label: 'With filters', value: totals.value.filtered },
]);

const emptyTitle = computed(() => {
    if (query.value.trim()) return 'Nothing matches “' + query.value.trim() + '”';
    return view.value === 'virtual' ? 'No virtual topics configured' : 'No topics found';
});

const emptyBody = computed(() =>
    query.value.trim()
        ? 'Try a shorter fragment, or switch the view — the filter only searches the current view.'
        : 'You can create virtual topics by clicking on the top right “New topic” button or using the Kawa CRDs');

const toggle = (name: string): void => {
    const next = new Set(collapsed.value);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    collapsed.value = next;
};

const open = (topic: Topic): void => {
    selected.value = topic;
    drawerOpen.value = true;
};

const edit = (topic: Topic): void => {
    void router.push(`/topics/${encodeURIComponent(topic.name)}/edit`);
};

const remove = useDeleteVirtualTopic()
const confirmOpen = ref(false);
const pendingDelete = ref<Topic | null>(null);
const askDelete = (topic: Topic): void => {
  remove.reset();
  confirmOpen.value = true;
  pendingDelete.value = topic;
}

const confirmDelete = async (): Promise<void> => {
  if (!pendingDelete.value) return;
  try {
    await remove.mutateAsync(pendingDelete.value.name);
    confirmOpen.value = false;
    pendingDelete.value = null;
    } catch {
     // keep dialog open so the mutation error can be read below
  }
};
</script>

<template>
    <div>
        <div class="head">
            <h1>Topics</h1>
            <p class="lede">
                Virtual topics are the names clients see. Each maps to exactly one physical topic upstream; a
                physical topic may back many virtual names.
            </p>
            <button class="btn btn-primary" @click="router.push('/topics/new')">
                <i class="ph-duotone ph-plus" />New topic
            </button>
        </div>

        <div class="stat-strip">
            <div v-for="stat in stats" :key="stat.label" class="stat">
                <div class="stat-label">{{ stat.label }}</div>
                <div class="stat-value">{{ stat.value }}</div>
            </div>
        </div>

        <div class="controls">
            <TabsRoot :model-value="view" class="seg" @update:model-value="view = $event as TopicView">
                <TabsList class="seg-list">
                    <TabsTrigger value="virtual" class="seg-opt">Virtual</TabsTrigger>
                    <TabsTrigger value="physical" class="seg-opt">Physical</TabsTrigger>
                    <TabsTrigger value="all" class="seg-opt">All</TabsTrigger>
                </TabsList>
            </TabsRoot>

            <div class="search">
                <input v-model="query" class="input" placeholder="Filter by name…" aria-label="Filter topics by name">
                <i class="ph-duotone ph-magnifying-glass" />
            </div>

          <label class="switch">
            <SwitchRoot v-model="showInternalTopics" class="switch-root">
              <SwitchThumb class="switch-thumb" />
            </SwitchRoot>
            <span>{{ showInternalTopics ? 'Hide' : 'Show' }} Internal Topics</span>
          </label>

            <span class="count muted">{{ rows.length }} of {{ totals.inView }} shown</span>
        </div>

        <p v-if="error" class="error">{{ error.message }}</p>

        <TopicTree
            v-if="rows.length"
            :rows="rows"
            :collapsed="collapsed"
            :view="view"
            @open="open"
            @toggle="toggle"
            @edit="edit"
            @delete="askDelete"
        />

        <div v-else class="empty">
            <i class="ph-duotone ph-stack" />
            <h4>{{ emptyTitle }}</h4>
            <p class="muted">{{ emptyBody }}</p>
        </div>

        <TopicDrawer
            v-model:open="drawerOpen"
            :topic="selected"
            :topics="topics"
            :acls="acls"
            @open-topic="open"
            @delete-topic="askDelete"
        />

       <ConfirmDialog
          v-model:open="confirmOpen"
          :title="'Delete ' + (pendingDelete?.name ?? '') + '?'"
          body="The virtual topic is removed from the gateway config. The physical topic and its data are untouched."
          confirm-label="Delete virtual topic"
          danger
           :pending="remove.isPending.value"
           @confirm="confirmDelete"
       >
           <p v-if="remove.error.value" class="error">{{ remove.error.value.message }}</p>
       </ConfirmDialog>
    </div>
</template>

<style scoped>
.head { display: flex; align-items: flex-end; gap: 24px; margin-bottom: 18px; }
.head .btn { flex: none; margin-left: auto; }
.stat-strip { margin-bottom: 20px; }
.controls { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-bottom: 6px; }
.seg-list { display: flex; }
.search { position: relative; width: 280px; }
.search .input { padding-left: 31px; font-size: 13px; width: 100%; box-sizing: border-box; }
.search i { position: absolute; left: 9px; top: 9px; font-size: 16px; color: var(--faint); }
.count { font-size: 12px; margin-left: auto; }
.error { font-size: 13px; color: var(--color-accent-2-700); }
.empty { padding: 50px 0 20px; max-width: 48ch; }
.empty i { font-size: 26px; color: var(--color-accent); }
.empty h4 { margin: 12px 0 6px; }
.empty p { font-size: 13px; }
.hint { font-size: 12px; color: var(--color-accent-700); }
</style>

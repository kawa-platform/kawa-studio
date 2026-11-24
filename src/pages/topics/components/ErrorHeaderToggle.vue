<script setup lang="ts">
/// Turns the `kawa-error` headers on or off for one filter or step: under `onDecodeError: include`
/// a record the filter or step fails on is delivered anyway, and these headers tell the client why.
const on = defineModel<boolean>({ required: true });
defineProps<{
    /// What the client gets the record as: "unfiltered" or "untransformed".
    delivered: string;
}>();
</script>

<template>
    <div class="error-header">
        <label class="check">
            <input v-model="on" type="checkbox">
            <span>Tell clients why a record arrives {{ delivered }}</span>
        </label>
        <p class="hint check-hint">
            Adds the <code>kawa-error</code> and <code>kawa-error-stage</code> headers to a record delivered despite a
            failure, because the value format's decode errors are set to include.
        </p>
    </div>
</template>

<style scoped>
.error-header { margin-top: 10px; }
.check { display: flex; align-items: center; gap: 9px; font-size: 13px; }
.check-hint { margin: 4px 0 0 24px; }
</style>

<template>
    <i class="ph-duotone ph-spinner spinner" />
</template>

<style scoped>
.spinner {
    animation: spin 0.8s linear infinite;
    display: inline-flex;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}
</style>

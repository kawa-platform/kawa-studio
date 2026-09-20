<script setup lang="ts" generic="T">
import { ref } from 'vue';
import {
    FlexRender, getCoreRowModel, getSortedRowModel, useVueTable,
    type ColumnDef, type SortingState,
} from '@tanstack/vue-table';

const props = defineProps<{
    columns: ColumnDef<T, any>[];
    data: T[];
    minWidth?: string;
    rowClickable?: boolean;
}>();

const emit = defineEmits<{ rowClick: [row: T] }>();

const sorting = ref<SortingState>([]);

const table = useVueTable({
    get data() { return props.data; },
    get columns() { return props.columns; },
    state: { get sorting() { return sorting.value; } },
    onSortingChange: (updater) => {
        sorting.value = typeof updater === 'function' ? updater(sorting.value) : updater;
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
});
</script>

<template>
    <div class="table-scroll">
        <table class="table" :style="{ minWidth: minWidth ?? '760px' }">
            <thead>
                <tr v-for="group in table.getHeaderGroups()" :key="group.id">
                    <th
                        v-for="header in group.headers"
                        :key="header.id"
                        :style="{ width: (header.column.columnDef.meta as any)?.width }"
                        :class="{ sortable: header.column.getCanSort() }"
                        @click="header.column.getToggleSortingHandler()?.($event)"
                    >
                        <FlexRender :render="header.column.columnDef.header" :props="header.getContext()" />
                        <span v-if="header.column.getIsSorted()" class="caret">{{
                            header.column.getIsSorted() === 'asc' ? '↑' : '↓'
                        }}</span>
                    </th>
                </tr>
            </thead>
            <tbody>
                <tr
                    v-for="row in table.getRowModel().rows"
                    :key="row.id"
                    :class="{ clickable: rowClickable }"
                    @click="rowClickable && emit('rowClick', row.original)"
                >
                    <td v-for="cell in row.getVisibleCells()" :key="cell.id">
                        <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                    </td>
                </tr>
                <tr v-if="!table.getRowModel().rows.length">
                    <td :colspan="columns.length" class="empty">Nothing to show.</td>
                </tr>
            </tbody>
        </table>
    </div>
</template>

<style scoped>
th.sortable { cursor: pointer; user-select: none; }
th.sortable:hover { color: var(--color-accent-700); }
.caret { margin-left: 5px; color: var(--color-accent); }
.empty { color: var(--muted); font-style: italic; padding: var(--space-5) 0; }
</style>

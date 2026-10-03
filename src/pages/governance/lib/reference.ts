import type { InjectionKey, Ref } from 'vue';

/// Lets the reference panel insert text into the expression editor the user last focused.
export interface CelInsertTarget {
    insert(text: string): void;
}

/// Provided by a page with a reference panel; expression editors register themselves on focus.
export interface CelInsertRegistry {
    focused(target: CelInsertTarget): void;
    gone(target: CelInsertTarget): void;
}

export const CEL_INSERT: InjectionKey<CelInsertRegistry> = Symbol('cel-insert');

/// Whether the page's reference panel is open, and how to open it from an inline hint.
export interface ReferencePanelState {
    open: Ref<boolean>;
    show(): void;
}

export const REFERENCE_PANEL: InjectionKey<ReferencePanelState> = Symbol('reference-panel');

import type { ManagedByView } from '@/api/types';

/// Why a managed record's edit/delete controls are disabled; undefined for unmanaged records,
/// so it can be bound straight to `:title`.
export function managedTitle(managedBy: ManagedByView | null | undefined): string | undefined {
    return managedBy ? `Managed by ${managedBy.principal}, change it through Kubernetes` : undefined;
}

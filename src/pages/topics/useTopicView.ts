import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { isTopicView, type TopicView } from './lib/rows';

/// The toggle lives in the URL query string (?view=all), not local storage: the selection
/// survives navigation, is shareable, and the back button behaves.
export function useTopicView() {
    const route = useRoute();
    const router = useRouter();

    return computed<TopicView>({
        get: () => (isTopicView(route.query.view) ? route.query.view : 'all'),
        set: (view) => { void router.replace({ query: { ...route.query, view } }); },
    });
}

<template>
  <section class="bg-white rounded-lg shadow-sm border border-gray-200 px-6 py-5">
    <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-4">Bestellprozess</h3>
    <div class="flex items-start">
      <template v-for="(s, i) in steps" :key="s.id">
        <div class="flex flex-col items-center text-center w-24 shrink-0">
          <div
            class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition"
            :class="circleClass(s.state)"
            :data-testid="`flow-step-${i + 1}`"
          >
            <svg
              v-if="s.state === 'done'"
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2.5"
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span v-else>{{ i + 1 }}</span>
          </div>
          <span class="text-xs mt-2 leading-tight" :class="labelClass(s.state)">{{ s.name }}</span>
          <!-- A skipped step has no date to show; its note takes that slot. -->
          <span v-if="s.note" class="text-[10px] text-gray-400 mt-0.5 italic">{{ s.note }}</span>
          <span
            v-else-if="s.visitedAt && s.state !== 'upcoming'"
            class="text-[10px] text-gray-400 mt-0.5"
            >{{ date(s.visitedAt) }}</span
          >
        </div>
        <div
          v-if="i < steps.length - 1"
          class="flex-1 h-0.5 mt-5 rounded"
          :class="connectorClass(s.state)"
        />
      </template>
    </div>
    <slot />
  </section>
</template>

<script lang="ts">
  /**
   * One step of the admin stepper, mirroring FlowStep in server/utils/orderStatus.
   * Exported from a plain script block so both admin pages can type their fetched
   * payload against the component that renders it.
   */
  export interface FlowStep {
    id: number
    name: string
    state: 'done' | 'current' | 'upcoming' | 'skipped'
    visitedAt: string | null
    note?: string
  }
</script>

<script setup lang="ts">
  /**
   * The order stepper, shared by the order detail and the pending confirmation
   * page. Both used to carry their own copy of this markup, which is how they
   * drifted apart — one kept showing the osCommerce part as untouched after a
   * manual confirmation while the other did not.
   */
  defineProps<{ steps: FlowStep[] }>()

  const { date } = useAdminFormat()

  function circleClass(state: FlowStep['state']): string {
    if (state === 'done') return 'bg-[#00af8c] text-white'
    if (state === 'current') return 'bg-[#00af8c] text-white ring-4 ring-[#00af8c]/25'
    // Skipped sits visually below "upcoming": upcoming is still ahead of the
    // order, skipped never applied to it at all.
    if (state === 'skipped')
      return 'bg-gray-50 border-2 border-dashed border-gray-300 text-gray-300'
    return 'bg-white border-2 border-gray-300 text-gray-400'
  }

  function labelClass(state: FlowStep['state']): string {
    if (state === 'upcoming') return 'text-gray-400'
    if (state === 'skipped') return 'text-gray-300'
    return 'text-gray-800 font-medium'
  }

  function connectorClass(state: FlowStep['state']): string {
    if (state === 'done') return 'bg-[#00af8c]'
    // Dashed rather than solid: nothing flowed through this step.
    if (state === 'skipped') return 'bg-transparent border-t-2 border-dashed border-gray-300'
    return 'bg-gray-200'
  }
</script>

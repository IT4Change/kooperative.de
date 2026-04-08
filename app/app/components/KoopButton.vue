<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'ghost' | 'danger'
  size?: 'md' | 'sm'
  to?: string
  href?: string
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  type: 'button',
  disabled: false,
})

const classes = computed(() => [
  props.variant === 'ghost' ? 'koop-btn--ghost' : '',
  props.variant === 'danger' ? 'koop-btn--danger' : '',
  props.size === 'sm' ? 'koop-btn--sm' : '',
  props.disabled ? 'koop-btn--disabled' : '',
])
</script>

<template>
  <NuxtLink v-if="to" :to="to" :class="['koop-btn', ...classes]">
    <span class="koop-btn__label"><slot /></span>
  </NuxtLink>
  <a v-else-if="href" :href="href" :class="['koop-btn', ...classes]">
    <span class="koop-btn__label"><slot /></span>
  </a>
  <button v-else :type="type" :disabled="disabled" :class="['koop-btn', ...classes]">
    <span class="koop-btn__label"><slot /></span>
  </button>
</template>

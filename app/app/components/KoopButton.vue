<script setup lang="ts">
interface Props {
  variant?: 'teal' | 'orange' | 'lila'
  size?: 'md' | 'sm'
  to?: string
  href?: string
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'teal',
  size: 'md',
  type: 'button',
  disabled: false,
})

const classes = computed(() => [
  props.variant === 'orange' ? 'koop-btn--orange' : '',
  props.variant === 'lila' ? 'koop-btn--lila' : '',
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

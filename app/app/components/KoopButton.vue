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
  'koop-btn',
  props.variant !== 'teal' ? `koop-btn--${props.variant}` : '',
  props.size === 'sm' ? 'koop-btn--sm' : '',
  props.disabled ? 'koop-btn--disabled' : '',
])
</script>

<template>
  <NuxtLink v-if="to" :to="to" :class="classes">
    <span class="koop-btn__label"><slot /></span>
  </NuxtLink>
  <a v-else-if="href" :href="href" :class="classes">
    <span class="koop-btn__label"><slot /></span>
  </a>
  <button v-else :type="type" :disabled="disabled" :class="classes">
    <span class="koop-btn__label"><slot /></span>
  </button>
</template>

<style scoped>
.koop-btn {
  --btn-color: var(--koop-teal);
  --btn-color-light: var(--koop-teal-hover);
  --btn-color-dark: var(--koop-teal-active);
  --btn-notch: 10px;
  --btn-depth: 4px;

  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 8rem;
  padding: 0.7rem 1.75rem;
  font-weight: 700;
  font-size: 1rem;
  color: #ffffff;
  text-decoration: none;
  background: none;
  border: none;
  cursor: pointer;
  transform: translateY(0);
  transition: transform 0.1s ease, filter 0.1s ease;
}

/* 3D bottom layer (shadow/depth) */
.koop-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  top: var(--btn-depth);
  background: var(--btn-color-dark);
  clip-path: polygon(
    0% var(--btn-notch),
    var(--btn-notch) 0%,
    calc(100% - var(--btn-notch)) 0%,
    100% var(--btn-notch),
    100% calc(100% - var(--btn-notch)),
    calc(100% - var(--btn-notch)) 100%,
    var(--btn-notch) 100%,
    0% calc(100% - var(--btn-notch))
  );
  z-index: 0;
}

/* Main face layer */
.koop-btn::after {
  content: '';
  position: absolute;
  inset: 0;
  bottom: var(--btn-depth);
  background: var(--btn-color);
  clip-path: polygon(
    0% var(--btn-notch),
    var(--btn-notch) 0%,
    calc(100% - var(--btn-notch)) 0%,
    100% var(--btn-notch),
    100% calc(100% - var(--btn-notch)),
    calc(100% - var(--btn-notch)) 100%,
    var(--btn-notch) 100%,
    0% calc(100% - var(--btn-notch))
  );
  z-index: 1;
  transition: inset 0.08s ease, background 0.08s ease;
}

.koop-btn__label {
  position: relative;
  z-index: 2;
  pointer-events: none;
  transform: translateY(calc(var(--btn-depth) / -2));
  transition: transform 0.08s ease;
}

/* Hover */
.koop-btn:hover::after {
  background: var(--btn-color-light);
}

/* Active/pressed */
.koop-btn:active::after {
  top: var(--btn-depth);
  bottom: 0;
  background: var(--btn-color);
}

.koop-btn:active .koop-btn__label {
  transform: translateY(calc(var(--btn-depth) / 2));
}

/* Variants */
.koop-btn--orange {
  --btn-color: var(--koop-orange);
  --btn-color-light: var(--koop-orange-hover);
  --btn-color-dark: var(--koop-orange-active);
}

.koop-btn--lila {
  --btn-color: var(--koop-lila);
  --btn-color-light: var(--koop-lila-hover);
  --btn-color-dark: var(--koop-lila-active);
}

.koop-btn--sm {
  min-width: 6rem;
  padding: 0.5rem 1.25rem;
  font-size: 0.875rem;
  --btn-notch: 8px;
  --btn-depth: 3px;
}

.koop-btn--disabled {
  opacity: 0.5;
  pointer-events: none;
}
</style>

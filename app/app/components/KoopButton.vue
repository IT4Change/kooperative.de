<script setup lang="ts">
  /**
   * Red is the default because red is Steiner's Glanz des Lebendigen — the
   * colour of the deed. A screen has one primary action and it wears red; blue
   * (Glanz der Seele) carries the alternatives, green confirms, yellow warns.
   * See app/assets/css/main.css for the palette and its contrast figures.
   */
  interface Props {
    variant?: 'red' | 'blue' | 'green' | 'yellow'
    size?: 'md' | 'sm'
    to?: string
    href?: string
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
  }

  const props = withDefaults(defineProps<Props>(), {
    variant: 'red',
    size: 'md',
    // Absent by default — which of the two is set decides whether the button
    // renders as NuxtLink, anchor or plain button.
    to: undefined,
    href: undefined,
    type: 'button',
    disabled: false,
  })

  const classes = computed(() => [
    'koop-btn',
    props.variant !== 'red' ? `koop-btn--${props.variant}` : '',
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
    --btn-face: var(--koop-red);
    --btn-face-hover: var(--koop-red-hover);
    --btn-depth-color: var(--koop-red-active);
    --btn-label: #ffffff;
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
    color: var(--btn-label);
    text-decoration: none;
    background: none;
    border: none;
    cursor: pointer;
    transform: translateY(0);
    transition:
      transform 0.1s ease,
      filter 0.1s ease;
  }

  /* 3D bottom layer (shadow/depth) */
  .koop-btn::before {
    content: '';
    position: absolute;
    inset: 0;
    top: var(--btn-depth);
    background: var(--btn-depth-color);
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
    background: var(--btn-face);
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
    transition:
      inset 0.08s ease,
      background 0.08s ease;
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
    background: var(--btn-face-hover);
  }

  /* Active/pressed */
  .koop-btn:active::after {
    top: var(--btn-depth);
    bottom: 0;
    background: var(--btn-face);
  }

  .koop-btn:active .koop-btn__label {
    transform: translateY(calc(var(--btn-depth) / 2));
  }

  /* Variants */
  .koop-btn--blue {
    --btn-face: var(--koop-blue);
    --btn-face-hover: var(--koop-blue-hover);
    --btn-depth-color: var(--koop-blue-active);
  }

  .koop-btn--green {
    --btn-face: var(--koop-green);
    --btn-face-hover: var(--koop-green-hover);
    --btn-depth-color: var(--koop-green-active);
  }

  /* The one variant that cannot carry a white label: white on #ffd200 is
     1.45:1. The ink reaches 9.45:1 instead. */
  .koop-btn--yellow {
    --btn-face: var(--koop-yellow);
    --btn-face-hover: var(--koop-yellow-hover);
    --btn-depth-color: var(--koop-yellow-active);
    --btn-label: var(--koop-ink);
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

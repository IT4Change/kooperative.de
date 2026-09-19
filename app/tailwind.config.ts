import type { Config } from 'tailwindcss'

/**
 * The same palette as the CSS custom properties in app/assets/css/main.css —
 * see there for what the colours mean and why each one is allowed where it is.
 *
 * Duplicated as literal hex rather than `var(--koop-red)` on purpose: Tailwind
 * 3 can only compute the `/opacity` modifier (bg-koop-blue/10 and friends, used
 * for the tinted chips) from a real colour value, not from a custom property.
 */
export default {
  theme: {
    extend: {
      colors: {
        koop: {
          red: '#c9253e',
          'red-hover': '#b02036',
          'red-active': '#961b2e',
          blue: '#003c7b',
          'blue-hover': '#00336a',
          'blue-active': '#002a58',
          yellow: '#ffd200',
          'yellow-hover': '#f2c800',
          'yellow-active': '#e0b900',
          green: '#008748',
          'green-hover': '#00743d',
          'green-active': '#006234',
          'peach-blossom': '#e4c9c7',
          ink: '#3a2a20',
          'ink-muted': '#6b5044',
          'ink-inverse': '#c9aaa4',
          brown: '#702f00',
        },
      },
    },
  },
} satisfies Config

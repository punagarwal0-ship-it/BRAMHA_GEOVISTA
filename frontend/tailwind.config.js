/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'paper-deep': 'var(--color-paper-deep)',
        paper: 'var(--color-paper)',
        'paper-2': 'var(--color-paper-2)',
        'paper-3': 'var(--color-paper-3)',
        'paper-surface': 'var(--color-paper-surface)',
        'paper-surface-hover': 'var(--color-paper-surface-hover)',
        ink: 'var(--color-ink)',
        'ink-2': 'var(--color-ink-2)',
        muted: 'var(--color-muted)',
        'muted-2': 'var(--color-muted-2)',
        rule: 'var(--color-rule)',
        'rule-2': 'var(--color-rule-2)',
        accent: 'var(--color-accent)',
        'accent-hover': 'var(--color-accent-hover)',
        'accent-ink': 'var(--color-accent-ink)',
        'accent-2': 'var(--color-accent-2)',
        'accent-secondary': 'var(--color-accent-secondary)',
        'telemetry-cyan': 'var(--color-telemetry-cyan)',
        'telemetry-amber': 'var(--color-telemetry-amber)',
        focus: 'var(--color-focus)',
        error: 'var(--color-error)',
        warning: 'var(--color-warning)',
        success: 'var(--color-success)',
      },
      fontFamily: {
        headline: ['var(--font-headline)', 'Georgia', 'serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-outlier)', 'monospace'],
        outlier: ['var(--font-outlier)', 'monospace'],
      },
      borderRadius: {
        panel: 'var(--radius-panel, 12px)',
        card: 'var(--radius-card, 10px)',
        control: 'var(--radius-control, 8px)',
        sm: 'var(--radius-sm, 4px)',
      }
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{vue,js,ts,jsx,tsx}",
    "./components/**/*.{vue,js,ts,jsx,tsx}",
    "./layouts/**/*.{vue,js,ts,jsx,tsx}",
    "./pages/**/*.{vue,js,ts,jsx,tsx}",
    "./plugins/**/*.{js,ts}",
    "./utils/**/*.{js,ts}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        page: 'var(--bg-page)',
        card: 'var(--bg-card)',
        'card-modal': 'var(--bg-card-modal)',
        dropdown: 'var(--bg-dropdown)',
        input: 'var(--bg-input)',
        btn: 'var(--bg-button)',
        'btn-hover': 'var(--bg-button-hover)',
        'row-hover': 'var(--bg-row-hover)',
        'border-primary': 'var(--border-primary)',
        'border-secondary': 'var(--border-secondary)',
        'border-tertiary': 'var(--border-tertiary)',
        'border-focus': 'var(--border-focus)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-tertiary': 'var(--text-tertiary)',
        'text-quaternary': 'var(--text-quaternary)',
        
        // Semantic statuses
        'blue-main': 'var(--color-blue)',
        'blue-main-hover': 'var(--color-blue-hover)',
        'blue-bg': 'var(--color-blue-bg)',
        'blue-border': 'var(--color-blue-border)',
        'blue-text': 'var(--color-blue-text)',
        
        'red-main': 'var(--color-red)',
        'red-bg': 'var(--color-red-bg)',
        'red-border': 'var(--color-red-border)',
        'red-text': 'var(--color-red-text)',
        
        'orange-bg': 'var(--color-orange-bg)',
        'orange-border': 'var(--color-orange-border)',
        'orange-text': 'var(--color-orange-text)',
        
        'green-bg': 'var(--color-green-bg)',
        'green-border': 'var(--color-green-border)',
        'green-text': 'var(--color-green-text)',
      }
    }
  },
  plugins: [],
}

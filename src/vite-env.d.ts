declare const __APP_RELEASE__: string

// global declaration merging для window.plausible работает только через interface —
// type для расширения встроенного Window физически не годится (осознанное исключение
// из правила "type, не interface", см. AGENTS.md)
interface Window {
  plausible?: ((
    event: string,
    options?: { props?: Record<string, string | number | boolean> },
  ) => void) & { q?: unknown[] }
}

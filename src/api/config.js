const configuredOrigin = globalThis.MULTILIDER_CONFIG?.apiOrigin ?? import.meta.env.VITE_API_URL ?? ''

export const apiOrigin = configuredOrigin.replace(/\/+$/, '')

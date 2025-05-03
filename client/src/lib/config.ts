/**
 * Base URL of your Express backend (no trailing slash).
 * Falls back to http://localhost:3001 if the env var isn’t set.
 */
export const API_URL =
    (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/+$/, '')

/**
 * Prefix for all your versioned API routes.
 */
const API_PREFIX = '/api/v1'

/**
 * Build a full API URL for the given path:
 *   apiPath('projects')   → 'http://localhost:3001/api/v1/projects'
 *   apiPath('/auth/me')   → 'http://localhost:3001/api/v1/auth/me'
 */
export function apiPath(path: string) {
    // strip leading slashes from `path`, then join
    const clean = path.replace(/^\/+/, '')
    return `${API_URL}${API_PREFIX}/${clean}`
}

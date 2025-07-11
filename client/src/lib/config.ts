/**
 * Base URL of your Express backend (no trailing slash).
 * Falls back to production server if env var isn't set.
 */
export const API_URL = (() => {
    // If we have an explicit env var, use it
    if (process.env.NEXT_PUBLIC_API_URL) {
        return process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
    }
    
    // Otherwise, determine based on environment
    if (typeof window !== 'undefined') {
        // Client-side: use current domain for production, localhost for dev
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'http://localhost:8080';
        } else if (hostname === 'www.lemona.studio' || hostname === 'lemona.studio') {
            // Use the same domain for API requests in production
            return `${window.location.protocol}//${hostname}`;
        } else {
            return 'https://lemona-app.onrender.com';
        }
    } else {
        // Server-side: default to production
        return 'https://lemona-app.onrender.com';
    }
})()

/**
 * Prefix for all your versioned API routes.
 */
const API_PREFIX = '/api/v1'

/**
 * Build a full API URL for the given path:
 *   apiPath('projects')   → 'http://localhost:8080/api/v1/projects'
 *   apiPath('/auth/me')   → 'http://localhost:8080/api/v1/auth/me'
 */
export function apiPath(path: string) {
    // strip leading slashes from `path`, then join
    const clean = path.replace(/^\/+/, '')
    return `${API_URL}${API_PREFIX}/${clean}`
}

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
        } else {
            return 'https://lemona-app.onrender.com';
        }
    } else {
        // Server-side: default to production
        return 'https://lemona-app.onrender.com';
    }
})()

/**
 * Helper function to construct API paths
 */
export function apiPath(path: string) {
    return `${API_URL}/api/${path}`;
}

/**
 * Stripe publishable key for client-side integration.
 * This must be set in production environment.
 */
export const STRIPE_PUBLISHABLE_KEY = (() => {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!key) {
        console.error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set. Stripe integration will not work.');
        return '';
    }
    return key;
})();

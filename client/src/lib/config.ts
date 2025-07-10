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
        // Server-side: default to production URL
        return 'https://lemona-app.onrender.com';
    }
})();

/**
 * Helper function to construct API paths
 */
export function apiPath(path: string) {
    return `${API_URL}/api/${path}`;
}

/**
 * Stripe publishable key for payment processing.
 * Uses live key in production, test key in development.
 */
export const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_live_51Qi6xuRutXiJrhxtfHUC3V4q2p3wUG3qTYh6SSPzae2E3BCMIN9Do0OqoEcfmqmMosGy5vpRkIj7a5rjihbNEdUf00iShGD6bJ';

// Add other configuration variables here

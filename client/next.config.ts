import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    /* config options here */
    // Removed COEP headers that were blocking cross-origin asset loading
    // Video export will gracefully fall back to asset download when SharedArrayBuffer is unavailable
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    /* config options here */
    async headers() {
        return [
            {
                // Apply these headers to all routes
                source: "/(.*)",
                headers: [
                    {
                        key: "Cross-Origin-Opener-Policy",
                        value: "same-origin",
                    },
                    {
                        key: "Cross-Origin-Embedder-Policy", 
                        value: "require-corp",
                    },
                ],
            },
        ];
    },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Disabled React Compiler temporarily to debug hydration issues
  // reactCompiler: true,
  
  // Disable strict mode to reduce hydration sensitivity
  reactStrictMode: false,
  
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'oaidalleapiprodscus.blob.core.windows.net', // DALL-E 3
      },
    ],
  },
};

export default nextConfig;

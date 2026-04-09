/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Treat pdfjs-dist as an external (not bundled by webpack) for server routes
    serverComponentsExternalPackages: ['pdfjs-dist'],
  },
  webpack: (config) => {
    // Prevent webpack from trying to bundle pdfjs canvas dependency
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;
    return config;
  },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Prevent webpack from bundling canvas/encoding (used by pdfjs)
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;
    return config;
  },
};

export default nextConfig;

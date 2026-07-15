/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Keep server-only secrets and Node APIs out of the client bundle.
    serverActions: { bodySizeLimit: "1mb" },
  },
};

export default nextConfig;

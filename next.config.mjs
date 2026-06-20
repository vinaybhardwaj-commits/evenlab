/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // pg is a Node-only dependency; keep it external to the server bundle (Next 14)
    serverComponentsExternalPackages: ["pg"],
  },
};

export default nextConfig;

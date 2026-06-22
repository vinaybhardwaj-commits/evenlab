/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Node-only deps with native binaries / data files — keep external so they
    // load from node_modules at runtime instead of being bundled (Next 14).
    serverComponentsExternalPackages: ["pg", "pdfkit", "@resvg/resvg-js", "pptxgenjs"],
  },
};

export default nextConfig;

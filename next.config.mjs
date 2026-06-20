/** @type {import('next').NextConfig} */
const nextConfig = {
  // External Google Fonts are loaded via <link> at runtime in the browser;
  // disable build-time font inlining so the build doesn't require network access.
  optimizeFonts: false,
};

export default nextConfig;

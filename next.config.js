/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // small local logo files only -- skip Vercel's image optimization
    // pipeline entirely, it was silently failing to render them.
    unoptimized: true,
  },
};

module.exports = nextConfig;

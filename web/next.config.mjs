/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.fallback = { ...config.resolve.fallback, "pino-pretty": false, encoding: false };

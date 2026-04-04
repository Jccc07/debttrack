/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  outputFileTracingIncludes: {
    "/dashboard": ["./src/app/(dashboard)/**/*"],
  },
};
module.exports = nextConfig;
/** @type {import('next').NextConfig} */
module.exports = {
  output: 'export', // Required for static export
  distDir: '../app', // 👈 This tells Next.js to build into Nextron's "app" folder
  trailingSlash: true,
  devIndicators: false,
  images: {
    unoptimized: true,
  },
  webpack: (config) => {
    return config;
  },
};

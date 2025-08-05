/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
    domains: ["assets.coingecko.com"],
  },
  webpack: (config, { isServer }) => {
    // Ignore optional dependencies that cause warnings
    config.externals = config.externals || [];
    config.externals.push({
      bufferutil: "bufferutil",
      "utf-8-validate": "utf-8-validate",
    });

    // Suppress warnings for Supabase realtime
    config.ignoreWarnings = [
      { module: /node_modules\/@supabase\/realtime-js/ },
      { module: /node_modules\/ws/ },
    ];

    return config;
  },
};

module.exports = nextConfig;

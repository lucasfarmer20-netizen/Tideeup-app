import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * The engine lives in /lib/ which has its own package.json with "type":"module".
   * The lib files use .js extensions in their imports (Node ESM convention).
   * This alias tells webpack to try .ts/.tsx before .js so those imports resolve.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  webpack(config: any) {
    config.resolve ??= {};
    config.resolve.extensionAlias = {
      '.js':  ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
      '.cjs': ['.cts', '.cjs'],
    };
    return config;
  },
};

export default nextConfig;

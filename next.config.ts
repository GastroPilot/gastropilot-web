import type { NextConfig } from "next";
import { readFileSync } from "fs";
import { resolve } from "path";
import withPWAInit from "@ducanh2912/next-pwa";
import createNextIntlPlugin from "next-intl/plugin";

const packageVersion = JSON.parse(
  readFileSync(resolve(__dirname, "package.json"), "utf-8")
).version as string;

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
});

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION ?? packageVersion,
  },
  output: 'standalone',

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.gpilot.app',
      },
      {
        protocol: 'https',
        hostname: '*.gastropilot.com',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },

  allowedDevOrigins: [
    'localhost:3000',
    '127.0.0.1:3000',
  ],
};

export default withPWA(withNextIntl(nextConfig));

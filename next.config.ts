import type { NextConfig } from "next";

// Allow the LAN/dev hosts a phone or tablet uses to hit `npm run dev` over the
// local network. Without this, Next.js 16 dev blocks cross-origin requests to
// dev resources (e.g. `/_next/webpack-hmr`) and the companion app stalls on
// "Checking your session..." when pointed at the laptop's LAN IP. Add new
// dev hosts here as you test from new devices.
const devOrigins = [
  "10.30.227.114",
  "127.0.0.1",
  "localhost",
];

const nextConfig: NextConfig = {
  allowedDevOrigins: devOrigins,
};

export default nextConfig;

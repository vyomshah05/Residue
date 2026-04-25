import path from "node:path";
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
  // Pin Turbopack's workspace root to this repo so a stray
  // `package-lock.json` in $HOME doesn't get picked up as the root and slow
  // dev startup / break path resolution.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;

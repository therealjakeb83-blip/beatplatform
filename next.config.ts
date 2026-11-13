import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Racine du projet écrite noir sur blanc : évite que Turbopack cherche les
  // modules (dont tailwindcss) dans le dossier parent C:\Users\nicoj.
  // Voir vercel/next.js#92978 (emballement de processus postcss.js).
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;

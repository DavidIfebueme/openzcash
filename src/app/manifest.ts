import type { MetadataRoute } from "next";

// Web App Manifest — makes OpenZcash installable as a standalone mobile app.
// Next serves this at /manifest.webmanifest and links it automatically.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OpenZcash · Zcash transparency",
    short_name: "OpenZcash",
    description:
      "Public transparency for the Zcash Dev Fund — Lockbox, ZCG and FPF grants, treasury and governance.",
    // The home is the ZCG overview; open the installed app there directly.
    start_url: "/zcg",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf8f4",
    theme_color: "#faf8f4",
    icons: [
      {
        src: "/icons/openzcash-v2-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/openzcash-v2-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/openzcash-v2-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

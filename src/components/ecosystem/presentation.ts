import type { CSSProperties } from "react";
import type { CATEGORIES } from "@/lib/ecosystem/catalog";

type Category = typeof CATEGORIES[number];
type CategoryTheme = { ink: string; tint: string; border: string; accent: string; icon: string };

// Category is the only colorful badge dimension. Funding and lifecycle stay
// neutral, so a purpose color never implies approval, payment or endorsement.
export const CATEGORY_THEMES = {
  Nodes: { ink: "#6d28d9", tint: "#f5f3ff", border: "#ddd6fe", accent: "#8b5cf6", icon: "M5 3h14v7H5z M5 14h14v7H5z M8 6.5h.01 M8 17.5h.01 M11 6.5h5 M11 17.5h5" },
  Wallets: { ink: "#1d4ed8", tint: "#eff6ff", border: "#bfdbfe", accent: "#3b82f6", icon: "M20 8V5H5a2 2 0 0 0 0 4h15v11H5a2 2 0 0 1-2-2V7 M20 12h-5v5h5 M16.5 14.5h.01" },
  "Libraries & SDKs": { ink: "#4338ca", tint: "#eef2ff", border: "#c7d2fe", accent: "#6366f1", icon: "m12 3 9 5-9 5-9-5 9-5Z M3 12l9 5 9-5 M3 16l9 5 9-5" },
  Cryptography: { ink: "#a21caf", tint: "#fdf4ff", border: "#f5d0fe", accent: "#d946ef", icon: "M5 10h14v11H5z M8 10V6a4 4 0 0 1 8 0v4 M12 14v3" },
  Infrastructure: { ink: "#0f766e", tint: "#f0fdfa", border: "#99f6e4", accent: "#14b8a6", icon: "M9 3h6v6H9z M2 16h6v5H2z M16 16h6v5h-6z M12 9v4 M5 16v-3h14v3" },
  Protocol: { ink: "#c2410c", tint: "#fff7ed", border: "#fed7aa", accent: "#f97316", icon: "m8 5-5 7 5 7 M16 5l5 7-5 7 M14 3l-4 18" },
  "Developer tools": { ink: "#334155", tint: "#f1f5f9", border: "#cbd5e1", accent: "#64748b", icon: "M3 4h18v16H3z m4 5 3 3-3 3 M13 15h4" },
  "Payments & DeFi": { ink: "#047857", tint: "#ecfdf5", border: "#a7f3d0", accent: "#10b981", icon: "M3 7h17 m-4-4 4 4-4 4 M21 17H4 m4-4-4 4 4 4" },
  Identity: { ink: "#be123c", tint: "#fff1f2", border: "#fecdd3", accent: "#f43f5e", icon: "M3 4h18v16H3z M17 9h1 M16 13h2 M10 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6 M6 18v-1a4 4 0 0 1 8 0v1" },
  Community: { ink: "#be185d", tint: "#fdf2f8", border: "#fbcfe8", accent: "#ec4899", icon: "M9 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6 M3 21v-4a6 6 0 0 1 12 0v4 M16 3a3 3 0 0 1 0 6 M18 12a5 5 0 0 1 3 5v4" },
  Education: { ink: "#92400e", tint: "#fffbeb", border: "#fde68a", accent: "#d97706", icon: "M12 6c-3-3-6-3-10-2v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-4-1-7-1-10 2Z M12 6v15" },
  Governance: { ink: "#854d0e", tint: "#fefce8", border: "#fde68a", accent: "#ca8a04", icon: "M4 9h16v12H4z M8 9V3h8v6 M8 5l2 2 4-4 M8 14h8" },
  Research: { ink: "#0e7490", tint: "#ecfeff", border: "#a5f3fc", accent: "#06b6d4", icon: "M9 3h6 M10 3v6L4 19a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2L14 9V3 M7 15h10" },
  Historical: { ink: "#713f12", tint: "#fefce8", border: "#fef08a", accent: "#a16207", icon: "M3 3h18v5H3z M5 8v13h14V8 M9 12h6" },
  Other: { ink: "#57534e", tint: "#f5f5f4", border: "#e7e5e4", accent: "#78716c", icon: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z" },
} satisfies Record<Category, CategoryTheme>;

export function categoryTheme(category: string): CategoryTheme {
  return Object.hasOwn(CATEGORY_THEMES, category)
    ? CATEGORY_THEMES[category as Category] : CATEGORY_THEMES.Other;
}

export function categoryStyle(category: string): CSSProperties {
  const theme = categoryTheme(category);
  return {
    "--category-ink": theme.ink,
    "--category-tint": theme.tint,
    "--category-border": theme.border,
    "--category-accent": theme.accent,
  } as CSSProperties;
}

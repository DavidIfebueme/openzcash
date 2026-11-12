import type { ReactNode } from "react";

/** Letter copy marks a phrase with `**…**`, as its Markdown draft does; that phrase is set in bold. */
export function emphasize(text: string): ReactNode[] {
  return text.split("**").map((part, index) => (index % 2 === 1 ? <strong key={index}>{part}</strong> : part));
}

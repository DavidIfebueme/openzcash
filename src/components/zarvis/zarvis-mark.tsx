import { getImageProps } from "next/image";
import type { ZarvisExpression } from "@/lib/zarvis/types";

// Original user-supplied artwork. The SVG is a viewport over a raster reference,
// not a vector redraw or an articulated character. Next optimizes the image.
const { props: portrait } = getImageProps({
  src: "/zarvis/ironwood-reference.png", alt: "", width: 606, height: 649,
});
const frames: Record<ZarvisExpression, string> = {
  idle: "17 620 122 133",
  listening: "147 620 124 133",
  thinking: "281 620 124 133",
  explaining: "542 620 124 133",
  error: "281 620 124 133",
};

export function ZarvisMark({ className = "", expression = "idle" }: {
  className?: string;
  expression?: ZarvisExpression;
}) {
  return <svg className={`zarvis-mark ${className}`} data-expression={expression}
    viewBox={frames[expression]} aria-hidden="true" focusable="false">
    <image href={portrait.src} width="1212" height="1297"/>
  </svg>;
}

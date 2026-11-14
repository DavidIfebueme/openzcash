import { cn } from "@/lib/utils";

/** Whether the chain reading is current, with the block it refers to. */
export function LivePill({
  live,
  height,
  idleLabel = "Connecting",
}: {
  live: boolean;
  height: number;
  /** Shown instead of "Live" while the reading is not current. */
  idleLabel?: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs shadow-sm">
      <span className="relative flex h-2 w-2">
        {live ? (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-70" />
        ) : null}
        <span
          className={cn(
            "relative inline-flex h-2 w-2 rounded-full",
            live ? "bg-emerald-500" : "bg-stone-300",
          )}
        />
      </span>
      <span className="font-medium text-stone-700">
        {live ? "Live" : idleLabel}
      </span>
      {height > 0 ? (
        <span className="tnum text-stone-600">
          · block {height.toLocaleString("en-US")}
        </span>
      ) : null}
    </div>
  );
}

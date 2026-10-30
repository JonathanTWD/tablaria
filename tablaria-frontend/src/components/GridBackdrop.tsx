import { cn } from "@/lib/utils";

/**
 * Faint spreadsheet grid, the product's own material, fading out from the top.
 * Decorative only; place it inside a `relative isolate` parent.
 */
export function GridBackdrop({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:3.5rem_2.25rem] [mask-image:radial-gradient(ellipse_70%_60%_at_30%_0%,black,transparent_75%)]",
        className,
      )}
    />
  );
}

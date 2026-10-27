import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Stays clickable until the request starts, so validation errors show on submit. */
export function SubmitButton({
  pending,
  children,
  className,
}: {
  pending: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} className={cn("h-11 w-full text-[0.95rem]", className)}>
      {pending && (
        <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
      )}
      {children}
    </Button>
  );
}

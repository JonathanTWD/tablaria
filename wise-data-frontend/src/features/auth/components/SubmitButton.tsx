import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** Stays clickable until the request starts, so validation errors show on submit. */
export function SubmitButton({
  pending,
  children,
}: {
  pending: boolean;
  children: ReactNode;
}) {
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} className="h-10 w-full">
      {pending && (
        <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
      )}
      {children}
    </Button>
  );
}

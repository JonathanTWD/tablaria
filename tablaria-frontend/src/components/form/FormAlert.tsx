import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";

/** Error for the whole form (wrong credentials, server unreachable…), announced to screen readers. */
export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <Alert variant="destructive" className="border-destructive/30 px-3 py-2.5">
      <CircleAlert aria-hidden="true" />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

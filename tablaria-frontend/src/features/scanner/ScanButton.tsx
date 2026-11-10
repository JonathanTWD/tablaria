import { ScanLine } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ScannerDialog } from "./ScannerDialog";

/** An icon button that opens the scanner; what a scan does depends on where it is. */
export function ScanButton({
  description,
  onScan,
  className,
}: {
  description: string;
  onScan: (value: string) => void;
  className?: string;
}) {
  const { t } = useTranslation("scanner");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              aria-label={t("open")}
              className={cn("size-9", className)}
              onClick={() => setOpen(true)}
            />
          }
        >
          <ScanLine aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>{t("open")}</TooltipContent>
      </Tooltip>
      <ScannerDialog open={open} onOpenChange={setOpen} description={description} onScan={onScan} />
    </>
  );
}

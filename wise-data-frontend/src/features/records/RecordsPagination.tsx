import type { PageMeta } from "@wisedata/shared";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAGE_SIZES } from "./records-view";

interface RecordsPaginationProps {
  meta: PageMeta;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function RecordsPagination({ meta, onPageChange, onPageSizeChange }: RecordsPaginationProps) {
  const { t, i18n } = useTranslation("records");
  const sizeId = useId();
  const number = new Intl.NumberFormat(i18n.language);
  const from = Math.min((meta.page - 1) * meta.pageSize + 1, meta.total);
  const to = Math.min(meta.page * meta.pageSize, meta.total);
  const sizes = Object.fromEntries(PAGE_SIZES.map((size) => [String(size), String(size)]));

  return (
    <nav
      aria-label={t("pagination.label")}
      className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"
    >
      <p aria-live="polite" className="tabular-nums">
        {t("pagination.range", {
          from: number.format(from),
          to: number.format(to),
          total: number.format(meta.total),
        })}
      </p>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor={sizeId}>{t("pagination.pageSize")}</label>
          <Select
            items={sizes}
            value={String(meta.pageSize)}
            onValueChange={(value) => value && onPageSizeChange(Number(value))}
          >
            <SelectTrigger id={sizeId} className="h-8 w-18">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="tabular-nums">
          {t("pagination.page", { page: meta.page, pageCount: Math.max(meta.pageCount, 1) })}
        </span>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label={t("pagination.previous")}
            disabled={meta.page <= 1}
            onClick={() => onPageChange(meta.page - 1)}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label={t("pagination.next")}
            disabled={meta.page >= meta.pageCount}
            onClick={() => onPageChange(meta.page + 1)}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>
    </nav>
  );
}

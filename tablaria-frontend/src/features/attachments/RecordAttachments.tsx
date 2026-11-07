import { useQuery } from "@tanstack/react-query";
import {
  type Attachment,
  ATTACHMENT_TYPES,
  isImageAttachment,
  MAX_ATTACHMENTS_PER_RECORD,
} from "@tablaria/shared";
import { FileText, Loader2, Paperclip, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { FormAlert } from "@/components/form/FormAlert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/features/auth/session";
import { apiErrorMessage } from "@/lib/error-message";
import { attachmentUrl } from "./api";
import { fileProblem, formatSize, uploadErrorMessage } from "./attachment-errors";
import { attachmentsQuery, useDeleteAttachment, useUploadAttachment } from "./queries";

/** Photos and documents of a record, in its sheet (ADR-039). */
export function RecordAttachments({
  tableId,
  recordId,
  canEdit,
}: {
  tableId: string;
  recordId: string;
  canEdit: boolean;
}) {
  const { t, i18n } = useTranslation("records");
  const attachments = useQuery(attachmentsQuery(tableId, recordId));
  const upload = useUploadAttachment(tableId, recordId);
  const isDemo = Boolean(useSession().data?.demoExpiresAt);
  const input = useRef<HTMLInputElement>(null);
  const [deleting, setDeleting] = useState<Attachment | null>(null);
  const count = attachments.data?.length ?? 0;
  const full = count >= MAX_ATTACHMENTS_PER_RECORD;

  async function uploadFiles(files: File[]) {
    // One at a time, so the limits of the record and the space apply in order.
    for (const file of files) {
      const problem = fileProblem(file);
      if (problem) {
        toast.error(problem);
        continue;
      }
      try {
        await upload.mutateAsync(file);
      } catch (error) {
        toast.error(uploadErrorMessage(error, file.name));
        return;
      }
    }
  }

  return (
    <section aria-labelledby="record-attachments" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 id="record-attachments" className="text-sm font-medium">
          {t("attachments.title")}
          {attachments.data && (
            <span className="ml-1.5 font-normal text-muted-foreground">
              {t("attachments.count", { count, max: MAX_ATTACHMENTS_PER_RECORD })}
            </span>
          )}
        </h3>
        {canEdit && !isDemo && (
          <>
            <Button
              variant="outline"
              className="h-9"
              disabled={full || upload.isPending || !attachments.data}
              aria-busy={upload.isPending}
              onClick={() => input.current?.click()}
            >
              {upload.isPending ? (
                <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
              ) : (
                <Paperclip aria-hidden="true" />
              )}
              {upload.isPending ? t("attachments.uploading") : t("attachments.add")}
            </Button>
            <input
              ref={input}
              type="file"
              accept={ATTACHMENT_TYPES.join(",")}
              multiple
              hidden
              onChange={(event) => {
                const files = [...(event.target.files ?? [])];
                // Cleared so choosing the same file again still fires a change.
                event.target.value = "";
                void uploadFiles(files);
              }}
            />
          </>
        )}
      </div>

      {attachments.isPending ? (
        <Skeleton className="h-24 rounded-lg" />
      ) : attachments.isError ? (
        <FormAlert>{apiErrorMessage(attachments.error)}</FormAlert>
      ) : count === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
          {canEdit && !isDemo
            ? t("attachments.emptyEditor")
            : canEdit
              ? t("attachments.demo")
              : t("attachments.empty")}
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {attachments.data.map((attachment) => {
            const url = attachmentUrl(tableId, recordId, attachment.id);
            return (
              <li key={attachment.id} className="group relative min-w-0">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-lg border border-border outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {isImageAttachment(attachment.contentType) ? (
                    <img
                      src={url}
                      alt={attachment.name}
                      loading="lazy"
                      className="aspect-square w-full bg-muted object-cover"
                    />
                  ) : (
                    <span className="flex aspect-square w-full flex-col items-center justify-center gap-1 bg-muted text-muted-foreground">
                      <FileText aria-hidden="true" className="size-7" />
                      <span className="text-xs font-medium">PDF</span>
                    </span>
                  )}
                  <span className="block truncate px-2 pt-1.5 text-xs" title={attachment.name}>
                    {attachment.name}
                  </span>
                  <span className="block px-2 pb-1.5 text-xs text-muted-foreground">
                    {formatSize(attachment.size, i18n.language)}
                  </span>
                </a>
                {canEdit && (
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute top-1 right-1 size-8 shadow-sm"
                    aria-label={t("attachments.delete", { name: attachment.name })}
                    onClick={() => setDeleting(attachment)}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {deleting && (
        <DeleteAttachmentDialog
          tableId={tableId}
          recordId={recordId}
          attachment={deleting}
          onClose={() => setDeleting(null)}
        />
      )}
    </section>
  );
}

function DeleteAttachmentDialog({
  tableId,
  recordId,
  attachment,
  onClose,
}: {
  tableId: string;
  recordId: string;
  attachment: Attachment;
  onClose: () => void;
}) {
  const { t } = useTranslation("records");
  const remove = useDeleteAttachment(tableId, recordId);
  return (
    <ConfirmDeleteDialog
      title={t("attachments.deleteTitle", { name: attachment.name })}
      description={t("attachments.deleteDescription")}
      confirmLabel={t("attachments.deleteSubmit")}
      pending={remove.isPending}
      error={remove.error && apiErrorMessage(remove.error)}
      onConfirm={() => remove.mutate(attachment.id, { onSuccess: onClose })}
      onOpenChange={(open) => !open && onClose()}
    />
  );
}

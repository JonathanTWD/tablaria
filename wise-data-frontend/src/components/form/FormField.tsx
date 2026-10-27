import type { ReactElement } from "react";
import { cloneElement } from "react";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";

interface FormFieldProps {
  id: string;
  label: string;
  description?: string;
  error?: string;
  /** The control; it receives the id and the accessibility attributes. */
  children: ReactElement<{
    id?: string;
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
  }>;
}

export function FormField({ id, label, description, error, children }: FormFieldProps) {
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, descriptionId].filter(Boolean).join(" ") || undefined;

  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {cloneElement(children, {
        id,
        "aria-invalid": Boolean(error),
        "aria-describedby": describedBy,
      })}
      {error ? (
        <FieldError id={errorId}>{error}</FieldError>
      ) : (
        description && <FieldDescription id={descriptionId}>{description}</FieldDescription>
      )}
    </Field>
  );
}

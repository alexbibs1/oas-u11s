// Reusable confirmation dialog. Replaces window.confirm() calls, which are
// (a) blocked in some embed contexts, (b) ugly on mobile, and (c) inconsistent
// with the rest of the app's shadcn/ui-based UI.
//
// Usage:
//   const confirm = useConfirm();
//   if (await confirm({ title: "Delete post?", description: "This cannot be undone." })) {
//     deleteM.mutate(p.id);
//   }
//
// Or controlled:
//   <ConfirmDialog
//     open={open}
//     onOpenChange={setOpen}
//     title="Delete post?"
//     description="This cannot be undone."
//     confirmLabel="Delete"
//     onConfirm={() => deleteM.mutate(p.id)}
//   />

import { useState, useCallback, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type ConfirmOptions = {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
}: ConfirmOptions & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription asChild>
              <div className="text-sm">{description}</div>
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            className={
              destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : undefined
            }
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Imperative hook for fire-and-forget confirmations. Returns an async
// function that resolves true if the user confirmed, false otherwise.
export function useConfirm() {
  const [state, setState] = useState<{
    options: ConfirmOptions;
    resolve: (v: boolean) => void;
  } | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ options, resolve });
    });
  }, []);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open && state) {
        state.resolve(false);
        setState(null);
      }
    },
    [state],
  );

  const handleConfirm = useCallback(() => {
    if (state) {
      state.resolve(true);
      setState(null);
    }
  }, [state]);

  const dialog = state ? (
    <ConfirmDialog
      open
      onOpenChange={handleOpenChange}
      onConfirm={handleConfirm}
      title={state.options.title}
      description={state.options.description}
      confirmLabel={state.options.confirmLabel}
      cancelLabel={state.options.cancelLabel}
      destructive={state.options.destructive}
    />
  ) : null;

  return { confirm, dialog };
}

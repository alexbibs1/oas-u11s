import { useCallback, useRef, useState, type ReactElement } from "react";
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
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type Props = ConfirmOptions & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel?: () => void;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  title = "Are you sure?",
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={cn(destructive && buttonVariants({ variant: "destructive" }))}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function useConfirm(): {
  confirm: (options?: ConfirmOptions) => Promise<boolean>;
  dialog: ReactElement;
} {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({});
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions = {}) => {
    setOptions(opts);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = (value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
  };

  const dialog = (
    <ConfirmDialog
      {...options}
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          settle(false);
          setOpen(false);
        }
      }}
      onConfirm={() => {
        settle(true);
        setOpen(false);
      }}
      onCancel={() => settle(false)}
    />
  );

  return { confirm, dialog };
}

"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Modal, ModalHeader, ModalContent, ModalFooter } from "./modal";
import { Button } from "./button";
import { AlertTriangle } from "lucide-react";

/**
 * Two-step destructive action: first click arms, second confirms. Prevents the
 * accidental one-tap deletes the app had everywhere. Blur disarms.
 */
export function ConfirmButton({
  onConfirm,
  idle = "Xoá",
  icon,
  className,
  disabled,
  "aria-label": ariaLabel,
  title = "Xác nhận thao tác",
  description = "Bạn có chắc chắn muốn thực hiện thao tác này? Hành động này không thể hoàn tác.",
  confirmText = "Xác nhận xoá",
}: {
  onConfirm: () => void;
  idle?: string;
  icon?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
  title?: string;
  description?: string;
  confirmText?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel ?? (typeof idle === "string" && idle ? undefined : "Xoá")}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          "text-destructive inline-flex items-center gap-1 transition-colors hover:underline",
          className,
        )}
      >
        {icon}
        {idle}
      </button>

      <Modal open={open} onClose={() => setOpen(false)}>
        <ModalHeader
          title={
            <span className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {title}
            </span>
          }
          onClose={() => setOpen(false)}
        />
        <ModalContent>
          <p className="text-muted-foreground">{description}</p>
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Huỷ</Button>
          <Button variant="destructive" onClick={() => { onConfirm(); setOpen(false); }}>
            {confirmText}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}

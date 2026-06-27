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
import { Button } from "@/components/ui/button";

interface AlertProps {
  readonly title: string;
  readonly message: string;
  readonly type: "confirm" | "info" | "error";
  readonly onConfirm?: () => void;
  readonly onCancel?: () => void;
  readonly onClose?: () => void;
}

export function Alert(props: AlertProps) {
  return (
    <AlertDialog open onOpenChange={(open) => !open && props.onClose?.()}>
      <AlertDialogContent className="animate-in fade-in zoom-in-95 duration-200">
        <AlertBody {...props} />
        <AlertActions {...props} />
      </AlertDialogContent>
    </AlertDialog>
  );
}

function AlertBody({ title, message, type }: AlertProps) {
  return (
    <div className="flex items-start gap-4">
      <AlertIcon type={type} />
      <div className="flex-1">
        <AlertDialogHeader className="space-y-2">
          <AlertDialogTitle className="text-lg">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-sm leading-relaxed">
            {message}
          </AlertDialogDescription>
        </AlertDialogHeader>
      </div>
    </div>
  );
}

function AlertActions({ type, onCancel, onClose, onConfirm }: AlertProps) {
  return (
    <AlertDialogFooter className="mt-4">
      {type === "confirm" ? (
        <ConfirmActions onCancel={onCancel} onConfirm={onConfirm} />
      ) : (
        <Button onClick={onClose} className="w-full transition-all hover:shadow-md">
          关闭
        </Button>
      )}
    </AlertDialogFooter>
  );
}

function ConfirmActions({
  onCancel,
  onConfirm,
}: {
  readonly onCancel?: () => void;
  readonly onConfirm?: () => void;
}) {
  return (
    <>
      <AlertDialogCancel onClick={onCancel} className="transition-all hover:shadow-md">
        取消
      </AlertDialogCancel>
      <AlertDialogAction onClick={onConfirm} className="transition-all hover:shadow-md">
        确认
      </AlertDialogAction>
    </>
  );
}

function AlertIcon({ type }: { readonly type: AlertProps["type"] }) {
  const className = iconClassName(type);
  return (
    <div className={className.wrapper}>
      <svg
        className={className.icon}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d={iconPath(type)}
        />
      </svg>
    </div>
  );
}

function iconClassName(type: AlertProps["type"]) {
  if (type === "error") {
    return {
      wrapper: "flex size-12 items-center justify-center rounded-full bg-red-100",
      icon: "size-6 text-red-600",
    };
  }
  if (type === "confirm") {
    return {
      wrapper: "flex size-12 items-center justify-center rounded-full bg-blue-100",
      icon: "size-6 text-blue-600",
    };
  }
  return {
    wrapper: "flex size-12 items-center justify-center rounded-full bg-green-100",
    icon: "size-6 text-green-600",
  };
}

function iconPath(type: AlertProps["type"]): string {
  if (type === "confirm") {
    return "M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z";
  }
  if (type === "error") {
    return "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z";
  }
  return "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z";
}

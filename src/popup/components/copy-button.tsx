"use client";

import { CopyIcon } from "lucide-react";
import { toast } from "sonner";

import { IconButton } from "@/components/ui/button";

export default function CopyButton({
  contentToCopy,
  icon,
}: {
  contentToCopy: string | null;
  icon?: React.ReactNode;
}) {
  const copyToClipboard = () => {
    if (!contentToCopy) return;
    navigator.clipboard.writeText(contentToCopy);
    toast.success("Copied to clipboard");
  };
  return (
    <IconButton
      disabled={!contentToCopy}
      type="button"
      className="mx-1 inline align-middle"
      onClick={copyToClipboard}
    >
      {icon || <CopyIcon className="size-4" />}
    </IconButton>
  );
}

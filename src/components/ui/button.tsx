import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { LoaderIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground dark:border-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        xs: "h-6 px-2 text-xs",
        sm: "h-9 rounded-md px-3 text-sm",
        lg: "h-11 rounded-md px-8",
        xl: "h-14 rounded-xl px-9",
        icon: "size-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  hoverAnimation?: boolean;
  loading?: boolean;
  loadingAltIcon?: React.ReactNode;
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      loading,
      hoverAnimation,
      asChild = false,
      loadingAltIcon,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";
    const cname = cn(buttonVariants({ variant, size, className }), {
      "hover:transition-all hover:will-change-transform hover:duration-300 hover:-translate-y-0.5 hover:shadow-lg":
        hoverAnimation,
    });

    return (
      <Comp
        disabled={props.disabled || loading}
        className={cname}
        ref={ref}
        {...props}
      >
        {!loading && loadingAltIcon}
        {loading && <LoaderIcon className="mr-2 size-4 animate-spin" />}
        {props.children}
      </Comp>
    );
  }
);
Button.displayName = "Button";

const IconButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, loading, disabled, ...props }, ref) => (
    <Button
      variant="ghost"
      size="icon"
      disabled={disabled || loading}
      ref={ref}
      {...props}
    >
      {loading && <LoaderIcon className="animate-spin" />}
      {!loading && children}
    </Button>
  )
);

IconButton.displayName = "IconButton";

export { IconButton, Button, buttonVariants };

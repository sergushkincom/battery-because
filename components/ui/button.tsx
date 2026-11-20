import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const button = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-[4px] border text-[13px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "border-primary bg-primary text-primary-foreground hover:opacity-90",
        accent: "border-accent bg-accent text-accent-foreground hover:opacity-90",
        ghost: "border-transparent bg-transparent text-foreground hover:bg-muted",
        outline: "border-border bg-surface text-foreground hover:bg-muted",
        destructive: "border-destructive bg-destructive text-white hover:opacity-90",
      },
      size: {
        sm: "h-7 px-2",
        md: "h-8 px-3",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: { variant: "outline", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof button>) {
  return <button className={cn(button({ variant, size }), className)} {...props} />;
}

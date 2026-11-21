import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const button = cva(
  "inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-[6px] border text-[13px] font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "border-primary bg-primary text-primary-foreground shadow-[0_1px_2px_rgb(16_24_40/0.12)] hover:border-primary-hover hover:bg-primary-hover",
        accent: "border-accent bg-accent text-accent-foreground shadow-[0_1px_2px_rgb(16_24_40/0.12)] hover:border-accent-hover hover:bg-accent-hover",
        ghost: "border-transparent bg-transparent text-foreground hover:bg-muted",
        outline: "border-border-strong bg-surface text-foreground shadow-[0_1px_2px_rgb(16_24_40/0.04)] hover:bg-muted",
        destructive: "border-destructive bg-destructive text-white hover:opacity-90 dark:text-[#1a0806]",
      },
      size: {
        sm: "h-7 px-2.5 text-[12px]",
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

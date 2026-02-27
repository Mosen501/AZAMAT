import { ButtonHTMLAttributes } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface CyberButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
}

export function CyberButton({
  children,
  className,
  variant = "primary",
  size = "md",
  fullWidth = false,
  disabled,
  ...props
}: CyberButtonProps) {
  const baseStyles = "relative inline-flex items-center justify-center font-display font-semibold tracking-widest uppercase overflow-hidden transition-all duration-300 clip-chamfer-sm z-10 group outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background";
  
  const variants = {
    primary: "bg-primary/10 text-primary border border-primary hover:bg-primary/20 shadow-[0_0_15px_rgba(0,240,255,0.15)] hover:shadow-[0_0_25px_rgba(0,240,255,0.3)]",
    secondary: "bg-secondary text-secondary-foreground border border-border hover:bg-secondary/80 hover:border-primary/50",
    danger: "bg-destructive/10 text-destructive border border-destructive hover:bg-destructive/20 shadow-[0_0_15px_rgba(255,51,102,0.15)] hover:shadow-[0_0_25px_rgba(255,51,102,0.3)]",
    ghost: "bg-transparent text-muted-foreground hover:text-primary hover:bg-primary/5",
  };

  const sizes = {
    sm: "text-xs px-4 py-2",
    md: "text-sm px-6 py-3",
    lg: "text-base px-8 py-4",
  };

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      className={cn(
        baseStyles,
        variants[variant],
        sizes[size],
        fullWidth ? "w-full" : "",
        disabled && "opacity-50 cursor-not-allowed saturate-50",
        className
      )}
      disabled={disabled}
      {...props}
    >
      {/* Glitch/Scanline Hover Effect overlay */}
      {!disabled && (
        <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none" />
      )}
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </motion.button>
  );
}

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ScoreGaugeProps {
  label: string;
  value: number;
  icon?: React.ReactNode;
  className?: string;
  isArabic?: boolean;
}

export function ScoreGauge({ label, value, icon, className, isArabic = false }: ScoreGaugeProps) {
  // Determine color based on score health (High is good? Let's assume >70 is good, <30 is critical)
  let colorClass = "bg-primary";
  let textColorClass = "text-primary";
  
  if (value < 30) {
    colorClass = "bg-destructive";
    textColorClass = "text-destructive";
  } else if (value < 60) {
    colorClass = "bg-warning";
    textColorClass = "text-warning";
  } else if (value >= 80) {
    colorClass = "bg-success";
    textColorClass = "text-success";
  }

  return (
    <div
      className={cn("flex flex-col gap-2 p-3 glass-panel border-t-0 border-r-0", className)}
      dir={isArabic ? "rtl" : "ltr"}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 text-xs font-display tracking-wider text-muted-foreground uppercase">
        <div className={cn("flex items-center gap-2 min-w-0", isArabic && "justify-start")}>
          {icon && <span className="opacity-70">{icon}</span>}
          <span className={cn("leading-5", isArabic && "text-right")}>{label}</span>
        </div>
        <span
          className={cn(
            "font-bold text-glow text-sm tabular-nums min-w-[4.5rem] text-right",
            textColorClass,
          )}
          dir="ltr"
          style={{ unicodeBidi: "isolate" }}
        >
          <span className="inline-flex items-baseline gap-0.5">
            <span>{Math.round(value)}</span>
            <span>%</span>
          </span>
        </span>
      </div>
      
      {/* Custom segmented progress bar */}
      <div className="h-2 w-full bg-background flex gap-[2px] p-[1px] border border-border/50 clip-chamfer-sm overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={cn("h-full", colorClass)}
          style={{
            boxShadow: `0 0 10px var(--${value < 30 ? 'destructive' : value < 60 ? 'warning' : value >= 80 ? 'success' : 'primary'})`
          }}
        />
      </div>
    </div>
  );
}

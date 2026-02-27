import { useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { CyberButton } from "@/components/CyberButton";
import { ScoreGauge } from "@/components/ScoreGauge";
import { useSimulation } from "@/hooks/use-simulation";
import { useGenerateDebrief } from "@/hooks/use-api";
import { ShieldAlert, Zap, MessageSquareWarning, FileText, CheckCircle2, AlertTriangle, Target, ListChecks, RotateCcw } from "lucide-react";
import { motion } from "framer-motion";

export default function Debrief() {
  const [, setLocation] = useLocation();
  const { state, resetSimulation } = useSimulation();
  
  const { mutate: generateDebrief, data: debrief, isPending, isError } = useGenerateDebrief();

  useEffect(() => {
    // Only generate if we have a role and history
    if (!state.role || state.history.length === 0) {
      setLocation("/");
      return;
    }

    // Trigger debrief generation if we don't have it yet
    if (!debrief && !isPending && !isError) {
      generateDebrief({
        role: state.role,
        history: state.history
      });
    }
  }, [state, debrief, isPending, isError, generateDebrief, setLocation]);

  const handleTryAgain = () => {
    resetSimulation();
    setLocation("/");
  };

  if (isPending || !debrief) {
    return (
      <Layout className="items-center justify-center">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-6 glass-panel p-12 max-w-md w-full text-center"
        >
          <div className="relative">
            <div className="w-24 h-24 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            <FileText className="w-8 h-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold uppercase text-glow tracking-widest mb-2">Compiling A.A.R.</h2>
            <p className="text-muted-foreground">AI is analyzing your decision matrix and generating the After-Action Report...</p>
          </div>
        </motion.div>
      </Layout>
    );
  }

  if (isError) {
    return (
      <Layout className="items-center justify-center">
        <div className="glass-panel p-8 text-center max-w-lg">
          <AlertTriangle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-display text-destructive mb-2 uppercase">Report Generation Failed</h2>
          <p className="text-muted-foreground mb-6">The AI subsystem encountered an error processing your results.</p>
          <CyberButton onClick={handleTryAgain} variant="secondary">Return Home</CyberButton>
        </div>
      </Layout>
    );
  }

  const Section = ({ title, icon, items, type }: { title: string, icon: React.ReactNode, items: string[], type: "success" | "warning" | "danger" | "info" }) => {
    const colors = {
      success: "border-success/30 bg-success/5 text-success",
      warning: "border-warning/30 bg-warning/5 text-warning",
      danger: "border-destructive/30 bg-destructive/5 text-destructive",
      info: "border-primary/30 bg-primary/5 text-primary"
    };

    return (
      <div className={`p-6 border clip-chamfer-sm ${colors[type]}`}>
        <div className="flex items-center gap-3 mb-4 border-b border-current/20 pb-3">
          <div className="opacity-80">{icon}</div>
          <h3 className="font-display font-bold uppercase tracking-wider text-lg">{title}</h3>
        </div>
        <ul className="space-y-3">
          {items.map((item, i) => (
            <li key={i} className="flex gap-3 text-foreground/90 leading-relaxed">
              <span className="opacity-50 mt-1">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <Layout className="py-8">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-5xl mx-auto w-full flex flex-col gap-8"
      >
        <div className="text-center mb-4">
          <h1 className="text-3xl md:text-4xl font-black font-display text-glow uppercase tracking-widest mb-2">After-Action Report</h1>
          <p className="text-muted-foreground text-lg">Role: <span className="text-primary font-bold">{state.role}</span></p>
        </div>

        {/* Final Scores */}
        <div className="glass-panel p-6">
          <h2 className="font-display uppercase tracking-widest text-muted-foreground mb-4 text-sm text-center">Final Metrics</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <ScoreGauge label="Risk Control" value={state.scores.riskControl} icon={<ShieldAlert className="w-5 h-5" />} className="bg-transparent border-none p-0" />
            <ScoreGauge label="Speed & Priority" value={state.scores.speed} icon={<Zap className="w-5 h-5" />} className="bg-transparent border-none p-0" />
            <ScoreGauge label="Stakeholder Comms" value={state.scores.comms} icon={<MessageSquareWarning className="w-5 h-5" />} className="bg-transparent border-none p-0" />
          </div>
        </div>

        {/* Debrief Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <Section title="Executive Summary" icon={<FileText />} items={debrief.summary} type="info" />
          </div>
          
          <Section title="What Went Well" icon={<CheckCircle2 />} items={debrief.wentWell} type="success" />
          <Section title="What To Improve" icon={<Target />} items={debrief.toImprove} type="warning" />
          
          <div className="md:col-span-2">
            <Section title="Missed Signals" icon={<AlertTriangle />} items={debrief.missedSignals} type="danger" />
          </div>
          
          <div className="md:col-span-2">
            <Section title="Next-Time Checklist" icon={<ListChecks />} items={debrief.checklist} type="info" />
          </div>
        </div>

        <div className="flex justify-center mt-8 pb-12">
          <CyberButton size="lg" onClick={handleTryAgain} className="min-w-[200px]">
            <RotateCcw className="w-5 h-5" />
            Restart Simulation
          </CyberButton>
        </div>
      </motion.div>
    </Layout>
  );
}

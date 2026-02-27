import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { CyberButton } from "@/components/CyberButton";
import { ScoreGauge } from "@/components/ScoreGauge";
import { useScenario } from "@/hooks/use-api";
import { useSimulation } from "@/hooks/use-simulation";
import { Clock, ShieldAlert, Zap, MessageSquareWarning, ChevronRight, AlertOctagon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Simulation() {
  const [, setLocation] = useLocation();
  const { data: scenario, isLoading, isError } = useScenario();
  const { state, initScores, recordChoice } = useSimulation();
  
  // Track current step locally. If we have history, we could resume, 
  // but for simplicity, start fresh or from last history item.
  const [currentStepId, setCurrentStepId] = useState<string | null>(null);

  // Initialize simulation
  useEffect(() => {
    if (!state.role) {
      setLocation("/"); // Enforce role selection
      return;
    }
    
    if (scenario && !currentStepId) {
      // If history exists, resume from last step's nextStepId
      if (state.history.length > 0) {
        // Need to find what the next step should be based on the last choice
        const lastAction = state.history[state.history.length - 1];
        const pastStep = scenario.steps[lastAction.stepId];
        const pastChoice = pastStep?.choices.find(c => c.id === lastAction.choiceId);
        
        if (pastChoice && pastChoice.nextStepId) {
          setCurrentStepId(pastChoice.nextStepId);
        } else {
          setLocation("/debrief"); // Simulation was already finished
        }
      } else {
        // Start fresh
        initScores(scenario.initialScores);
        setCurrentStepId(scenario.startStepId);
      }
    }
  }, [scenario, state.role, state.history, currentStepId, setLocation, initScores]);

  if (isLoading) {
    return (
      <Layout className="items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <p className="font-display uppercase text-primary animate-pulse tracking-widest text-lg">Decrypting Scenario Data...</p>
        </div>
      </Layout>
    );
  }

  if (isError || !scenario) {
    return (
      <Layout className="items-center justify-center">
        <div className="glass-panel p-8 text-center max-w-lg">
          <AlertOctagon className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-display text-destructive mb-2 uppercase">System Error</h2>
          <p className="text-muted-foreground mb-6">Failed to load simulation parameters. Please contact administration.</p>
          <CyberButton onClick={() => window.location.reload()}>Reboot System</CyberButton>
        </div>
      </Layout>
    );
  }

  const currentStep = currentStepId ? scenario.steps[currentStepId] : null;

  const handleChoice = (choiceId: string) => {
    if (!currentStep) return;
    
    const choice = currentStep.choices.find(c => c.id === choiceId);
    if (!choice) return;

    recordChoice(currentStepId, choiceId, choice.scoreDeltas);
    
    if (choice.nextStepId) {
      setCurrentStepId(choice.nextStepId);
    } else {
      // End of simulation
      setLocation("/debrief");
    }
  };

  if (!currentStep) return null; // Catch-all while transitioning

  return (
    <Layout className="flex flex-col gap-6">
      {/* Header Dashboard Status */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-4 flex flex-col justify-center items-center border-l-4 border-l-primary bg-primary/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-20"><Clock className="w-16 h-16" /></div>
          <span className="text-xs text-primary font-display tracking-widest uppercase mb-1 z-10">Current Timeline</span>
          <span className="text-3xl font-black font-display text-glow z-10">{currentStep.timeLabel}</span>
        </div>
        
        <div className="col-span-1 lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ScoreGauge label="Risk Control" value={state.scores.riskControl} icon={<ShieldAlert className="w-4 h-4" />} />
          <ScoreGauge label="Speed & Priority" value={state.scores.speed} icon={<Zap className="w-4 h-4" />} />
          <ScoreGauge label="Stakeholder Comms" value={state.scores.comms} icon={<MessageSquareWarning className="w-4 h-4" />} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        
        {/* Main Event Feed */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 bg-destructive rounded-full animate-pulse shadow-[0_0_10px_rgba(255,51,102,0.8)]"></span>
            <h2 className="font-display text-lg uppercase tracking-wider text-muted-foreground">Incoming Intelligence</h2>
          </div>
          
          <AnimatePresence mode="wait">
            <motion.div 
              key={currentStep.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.4 }}
              className="glass-panel p-6 md:p-8 flex-1 relative border-t-2 border-t-destructive/50"
            >
              {/* Decorative corners */}
              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary/50"></div>
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary/50"></div>
              
              <h3 className="text-2xl font-bold mb-6 text-foreground leading-relaxed">
                {currentStep.description}
              </h3>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Action Panel */}
        <div className="flex flex-col gap-4 h-full">
          <div className="flex items-center gap-2 mb-2">
            <ChevronRight className="w-5 h-5 text-primary" />
            <h2 className="font-display text-lg uppercase tracking-wider text-muted-foreground">Awaiting Directive</h2>
          </div>
          
          <div className="flex flex-col gap-4 flex-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep.id + "-choices"}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4, staggerChildren: 0.1 }}
                className="flex flex-col gap-4 h-full"
              >
                {currentStep.choices.map((choice, index) => (
                  <motion.button
                    key={choice.id}
                    onClick={() => handleChoice(choice.id)}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex-1 text-left bg-secondary/30 border border-primary/20 hover:border-primary hover:bg-primary/10 p-5 clip-chamfer-sm transition-all duration-300 group hover:shadow-[0_0_15px_rgba(0,240,255,0.15)] flex items-center justify-between"
                  >
                    <span className="text-foreground/90 group-hover:text-white font-medium leading-snug pr-4">
                      {choice.text}
                    </span>
                    <div className="w-8 h-8 rounded bg-background flex items-center justify-center border border-primary/30 group-hover:border-primary transition-colors shrink-0">
                      <span className="font-display text-primary">{index + 1}</span>
                    </div>
                  </motion.button>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

      </div>
    </Layout>
  );
}

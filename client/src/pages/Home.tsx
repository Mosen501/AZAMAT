import { Layout } from "@/components/Layout";
import { CyberButton } from "@/components/CyberButton";
import { useSimulation } from "@/hooks/use-simulation";
import { useLocation } from "wouter";
import { Shield, Radio, Activity, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  const { state, setRole, resetSimulation } = useSimulation();
  const [, setLocation] = useLocation();

  const handleStart = () => {
    if (!state.role) return;
    setLocation("/sim");
  };

  const handleRoleSelect = (role: string) => {
    resetSimulation(); // Ensure clean slate
    setRole(role);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <Layout className="justify-center items-center">
      <motion.div 
        className="w-full max-w-4xl"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="text-center mb-12">
          <motion.div variants={itemVariants} className="inline-flex items-center justify-center p-4 rounded-full bg-primary/5 border border-primary/20 mb-6 box-glow">
            <AlertTriangle className="w-12 h-12 text-primary" />
          </motion.div>
          <motion.h1 variants={itemVariants} className="text-4xl md:text-6xl font-black mb-4 text-glow tracking-tight text-primary uppercase">
            Critical Incident Protocol
          </motion.h1>
          <motion.p variants={itemVariants} className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto font-light">
            Prepare for the unpredictable. Experience a high-stakes, real-time crisis simulation that tests your decision-making under pressure.
          </motion.p>
        </div>

        <motion.div variants={itemVariants} className="glass-panel p-8 md:p-12 mb-8">
          <div className="flex items-center gap-3 mb-8 border-b border-primary/20 pb-4">
            <Activity className="w-6 h-6 text-primary animate-pulse" />
            <h2 className="text-xl text-foreground font-semibold">Select Operational Role</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-10">
            {/* Role 1 */}
            <button 
              onClick={() => handleRoleSelect("Team Lead")}
              className={`text-left p-6 clip-chamfer transition-all duration-300 border ${
                state.role === "Team Lead" 
                  ? "bg-primary/10 border-primary shadow-[0_0_20px_rgba(0,240,255,0.15)]" 
                  : "bg-secondary/40 border-border hover:bg-secondary hover:border-primary/50"
              }`}
            >
              <Shield className={`w-10 h-10 mb-4 ${state.role === "Team Lead" ? "text-primary text-glow" : "text-muted-foreground"}`} />
              <h3 className={`text-xl font-display font-bold uppercase mb-2 ${state.role === "Team Lead" ? "text-primary" : "text-foreground"}`}>
                Operations Lead
              </h3>
              <p className="text-sm text-muted-foreground">
                Command the technical and operational response. Prioritize systems recovery, risk mitigation, and engineering coordination.
              </p>
            </button>

            {/* Role 2 */}
            <button 
              onClick={() => handleRoleSelect("Comms Lead")}
              className={`text-left p-6 clip-chamfer transition-all duration-300 border ${
                state.role === "Comms Lead" 
                  ? "bg-primary/10 border-primary shadow-[0_0_20px_rgba(0,240,255,0.15)]" 
                  : "bg-secondary/40 border-border hover:bg-secondary hover:border-primary/50"
              }`}
            >
              <Radio className={`w-10 h-10 mb-4 ${state.role === "Comms Lead" ? "text-primary text-glow" : "text-muted-foreground"}`} />
              <h3 className={`text-xl font-display font-bold uppercase mb-2 ${state.role === "Comms Lead" ? "text-primary" : "text-foreground"}`}>
                Comms Lead
              </h3>
              <p className="text-sm text-muted-foreground">
                Manage internal and external narratives. Handle PR fallout, stakeholder updates, and protect brand reputation during the outage.
              </p>
            </button>
          </div>

          <div className="flex justify-center">
            <CyberButton 
              size="lg" 
              disabled={!state.role} 
              onClick={handleStart}
              className="min-w-[250px]"
            >
              {state.role ? "INITIALIZE SIMULATION" : "AWAITING ROLE SELECTION"}
            </CyberButton>
          </div>
        </motion.div>
      </motion.div>
    </Layout>
  );
}

import { Layout } from "@/components/Layout";
import { useScenario } from "@/hooks/use-api";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Database, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function Admin() {
  const { data: scenario, isLoading, isError } = useScenario();

  return (
    <Layout className="flex flex-col">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-primary/20">
        <Database className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-display font-bold uppercase tracking-wider text-glow">System Data Inspector</h1>
      </div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex-1 glass-panel p-4 md:p-6 overflow-hidden flex flex-col"
      >
        <h2 className="font-display text-sm uppercase text-muted-foreground mb-4">Active Scenario Configuration (scenario.json)</h2>
        
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-primary/50 animate-pulse font-display tracking-widest uppercase">
            Loading Dataset...
          </div>
        ) : isError ? (
          <div className="flex-1 flex flex-col items-center justify-center text-destructive gap-4">
            <AlertCircle className="w-12 h-12" />
            <p>Error retrieving scenario data.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto rounded border border-border/50 bg-[#1d1f21] custom-scrollbar">
            <SyntaxHighlighter 
              language="json" 
              style={atomDark}
              customStyle={{
                margin: 0,
                padding: '1.5rem',
                background: 'transparent',
                fontSize: '0.9rem',
              }}
            >
              {JSON.stringify(scenario, null, 2)}
            </SyntaxHighlighter>
          </div>
        )}
      </motion.div>

      {/* Global styling for custom scrollbar within SyntaxHighlighter to match theme */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.2);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: hsl(var(--primary)/0.3);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: hsl(var(--primary)/0.5);
        }
      `}} />
    </Layout>
  );
}

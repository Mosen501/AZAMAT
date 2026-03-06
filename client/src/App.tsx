import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/lib/language";
import NotFound from "@/pages/not-found";

import Home from "@/pages/Home";
import Simulation from "@/pages/Simulation";
import Debrief from "@/pages/Debrief";
import Admin from "@/pages/Admin";
import AdvancedSimulation from "@/pages/AdvancedSimulation";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/sim" component={Simulation} />
      <Route path="/advanced" component={AdvancedSimulation} />
      <Route path="/debrief" component={Debrief} />
      <Route path="/admin" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;

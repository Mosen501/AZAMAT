import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { type Scenario, type DebriefRequest, type DebriefResponse } from "@shared/schema";

export function useScenario() {
  return useQuery<Scenario>({
    queryKey: [api.scenario.get.path],
    queryFn: async () => {
      const res = await fetch(api.scenario.get.path, {
        headers: { "Accept": "application/json" }
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch scenario: ${res.statusText}`);
      }
      return res.json();
    },
    staleTime: Infinity, // Scenario rarely changes during a session
  });
}

export function useGenerateDebrief() {
  return useMutation<DebriefResponse, Error, DebriefRequest>({
    mutationFn: async (data) => {
      const res = await fetch(api.debrief.generate.path, {
        method: api.debrief.generate.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      
      if (!res.ok) {
        throw new Error(`Failed to generate debrief: ${res.statusText}`);
      }
      return res.json();
    }
  });
}

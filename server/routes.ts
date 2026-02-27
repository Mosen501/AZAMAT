import type { Express } from "express";
import type { Server } from "http";
import { api, errorSchemas } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// The single scenario to be served to the frontend
const SCENARIO_DATA = {
  id: "payment-outage-01",
  title: "Payment Outage & Social Media Backlash",
  description: "Your payment gateway has just gone down. Customers are unable to checkout, and the complaints are rapidly piling up on social media.",
  startStepId: "step1",
  initialScores: {
    riskControl: 50,
    speed: 50,
    comms: 50
  },
  steps: {
    "step1": {
      id: "step1",
      timeLabel: "T+0m",
      description: "Alerts are firing: checkout conversion rate has dropped to 0%. Engineering suspects the third-party payment gateway is down. Customer support is starting to see tickets.",
      choices: [
        {
          id: "1a",
          text: "Immediately pause all marketing campaigns to stop new traffic.",
          scoreDeltas: { riskControl: 10, speed: 5, comms: 0 },
          nextStepId: "step2"
        },
        {
          id: "1b",
          text: "Wait 15 minutes to see if it's a transient blip.",
          scoreDeltas: { riskControl: -15, speed: -10, comms: -5 },
          nextStepId: "step2"
        },
        {
          id: "1c",
          text: "Post a proactive 'We are investigating an issue' message on social media.",
          scoreDeltas: { riskControl: 5, speed: 10, comms: 15 },
          nextStepId: "step2"
        }
      ]
    },
    "step2": {
      id: "step2",
      timeLabel: "T+15m",
      description: "Social media volume is spiking. A prominent influencer just tweeted: 'Is @YourBrand stealing our credit card info? Transactions failing but I got charged!'",
      choices: [
        {
          id: "2a",
          text: "Reply directly to the influencer explaining it's a gateway issue.",
          scoreDeltas: { riskControl: -5, speed: 5, comms: 10 },
          nextStepId: "step3"
        },
        {
          id: "2b",
          text: "Publish a generic incident status page and link it on all channels.",
          scoreDeltas: { riskControl: 10, speed: 5, comms: 15 },
          nextStepId: "step3"
        },
        {
          id: "2c",
          text: "Ignore the influencer and focus solely on the engineering fix.",
          scoreDeltas: { riskControl: 0, speed: 10, comms: -20 },
          nextStepId: "step3"
        }
      ]
    },
    "step3": {
      id: "step3",
      timeLabel: "T+30m",
      description: "Engineering confirms the gateway is down, but we can temporarily route traffic to a backup gateway with higher fees and lower fraud protection.",
      choices: [
        {
          id: "3a",
          text: "Switch to the backup immediately to restore revenue.",
          scoreDeltas: { riskControl: -15, speed: 20, comms: 5 },
          nextStepId: "step4"
        },
        {
          id: "3b",
          text: "Evaluate the fraud risks for 30 more minutes before switching.",
          scoreDeltas: { riskControl: 15, speed: -15, comms: 0 },
          nextStepId: "step4"
        },
        {
          id: "3c",
          text: "Keep the system down, put up a maintenance page, and wait for the primary provider.",
          scoreDeltas: { riskControl: 10, speed: -10, comms: -5 },
          nextStepId: "step4"
        }
      ]
    },
    "step4": {
      id: "step4",
      timeLabel: "T+45m",
      description: "Customer support is overwhelmed. The queue is 10x normal capacity. VIP clients are threatening to cancel their contracts.",
      choices: [
        {
          id: "4a",
          text: "Draft a mass email to all VIP clients with a dedicated support line.",
          scoreDeltas: { riskControl: 5, speed: 5, comms: 20 },
          nextStepId: "step5"
        },
        {
          id: "4b",
          text: "Deploy an automated chatbot response for all incoming tickets.",
          scoreDeltas: { riskControl: 0, speed: 15, comms: -10 },
          nextStepId: "step5"
        },
        {
          id: "4c",
          text: "Pull engineers off the fix to help answer support tickets.",
          scoreDeltas: { riskControl: -20, speed: -15, comms: 5 },
          nextStepId: "step5"
        }
      ]
    },
    "step5": {
      id: "step5",
      timeLabel: "T+60m",
      description: "The CEO is demanding an update and wants to know if we should issue a press release about a potential cyber attack.",
      choices: [
        {
          id: "5a",
          text: "Agree to the press release to be fully transparent.",
          scoreDeltas: { riskControl: -20, speed: 0, comms: -15 },
          nextStepId: "step6"
        },
        {
          id: "5b",
          text: "Push back on the CEO. Advise sticking to 'technical issue' until confirmed.",
          scoreDeltas: { riskControl: 20, speed: 5, comms: 10 },
          nextStepId: "step6"
        },
        {
          id: "5c",
          text: "Tell the CEO you'll handle it and give no further details.",
          scoreDeltas: { riskControl: -10, speed: 10, comms: -20 },
          nextStepId: "step6"
        }
      ]
    },
    "step6": {
      id: "step6",
      timeLabel: "T+90m",
      description: "Primary payment gateway comes back online, but they are processing a huge backlog. Transactions are slow.",
      choices: [
        {
          id: "6a",
          text: "Re-enable checkout for all users immediately.",
          scoreDeltas: { riskControl: -10, speed: 15, comms: 0 },
          nextStepId: "step7"
        },
        {
          id: "6b",
          text: "Throttle checkout traffic to 10% to monitor stability.",
          scoreDeltas: { riskControl: 15, speed: -5, comms: 5 },
          nextStepId: "step7"
        },
        {
          id: "6c",
          text: "Leave the system offline until the gateway's backlog is fully cleared.",
          scoreDeltas: { riskControl: 10, speed: -20, comms: -5 },
          nextStepId: "step7"
        }
      ]
    },
    "step7": {
      id: "step7",
      timeLabel: "T+120m",
      description: "System is mostly stable, but some users were double-charged during the transition.",
      choices: [
        {
          id: "7a",
          text: "Wait for users to complain, then manually refund.",
          scoreDeltas: { riskControl: -15, speed: -10, comms: -20 },
          nextStepId: "step8"
        },
        {
          id: "7b",
          text: "Run a database script to automatically refund duplicates overnight.",
          scoreDeltas: { riskControl: 5, speed: 10, comms: 0 },
          nextStepId: "step8"
        },
        {
          id: "7c",
          text: "Announce the issue proactively and promise automated refunds.",
          scoreDeltas: { riskControl: 10, speed: 5, comms: 20 },
          nextStepId: "step8"
        }
      ]
    },
    "step8": {
      id: "step8",
      timeLabel: "T+24h",
      description: "The crisis is over. It's time to communicate the post-mortem.",
      choices: [
        {
          id: "8a",
          text: "Publish a detailed, technical RCA blog post publicly.",
          scoreDeltas: { riskControl: 10, speed: 0, comms: 20 },
          nextStepId: null
        },
        {
          id: "8b",
          text: "Send a brief apology email, keep technical details internal.",
          scoreDeltas: { riskControl: 15, speed: 5, comms: -5 },
          nextStepId: null
        },
        {
          id: "8c",
          text: "Blame the payment vendor explicitly on social media.",
          scoreDeltas: { riskControl: -25, speed: 0, comms: -20 },
          nextStepId: null
        }
      ]
    }
  }
};

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {

  app.get(api.scenario.get.path, async (req, res) => {
    res.json(SCENARIO_DATA);
  });

  app.post(api.debrief.generate.path, async (req, res) => {
    try {
      const input = api.debrief.generate.input.parse(req.body);

      // Construct context for the AI
      const historyContext = input.history.map(item => {
        const step = SCENARIO_DATA.steps[item.stepId as keyof typeof SCENARIO_DATA.steps];
        const choice = step?.choices.find(c => c.id === item.choiceId);
        return `- At ${step?.timeLabel}: Chose "${choice?.text}"`;
      }).join("\n");

      const prompt = `
You are an expert crisis management assessor evaluating a user's performance in a crisis simulation.
The scenario was: ${SCENARIO_DATA.title} - ${SCENARIO_DATA.description}
The user played the role of: ${input.role}

Here is their action history:
${historyContext}

Generate an After-Action Report (AAR) in JSON format matching exactly this structure:
{
  "summary": ["point 1", "point 2", "point 3"],
  "wentWell": ["point 1", "point 2", "point 3"],
  "toImprove": ["point 1", "point 2", "point 3"],
  "missedSignals": ["point 1", "point 2"],
  "checklist": ["item 1", "item 2", "item 3", "item 4", "item 5", "item 6"]
}

Base your feedback on their choices. Be constructive but critical. Keep points concise. Do not use markdown backticks in the final JSON response, just return valid JSON.`;

      const aiResponse = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          { role: "system", content: "You are an AI that only outputs valid JSON." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      });

      const responseContent = aiResponse.choices[0]?.message?.content || "{}";
      const parsedData = JSON.parse(responseContent);
      
      res.json(parsedData);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          message: err.errors[0]?.message || "Validation Error"
        });
      } else {
        console.error("Debrief generation error:", err);
        res.status(500).json({ message: "Failed to generate debrief." });
      }
    }
  });

  return httpServer;
}

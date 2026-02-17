import "dotenv/config";
import express from "express";
import { createAgent } from "./lib/agent.js";

const app = express();
app.use(express.json());

let agentInstance: Awaited<ReturnType<typeof createAgent>> | null = null;

(async () => {
  try {
    agentInstance = await createAgent();
    console.log("SQL agent ready.");
  } catch (err) {
    console.error("Failed to create agent:", err);
  }
})();

app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== "string") {
      res.status(400).json({ error: "Missing or invalid 'message' in body." });
      return;
    }
    if (!agentInstance) {
      res.status(503).json({ error: "Agent not ready yet. Try again in a moment." });
      return;
    }

    const result = await agentInstance.invoke({
      input: message,
    });

    res.json({
      response: result.output,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

const PORT = process.env.SERVER_PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`SQL Chatbot running on port ${PORT}`);
});

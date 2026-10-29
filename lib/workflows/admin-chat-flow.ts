import { WorkflowAgent, type ModelCallStreamPart } from "@ai-sdk/workflow";
import { getWritable } from "workflow";
import {
  convertToModelMessages,
  type UIMessage,
} from "ai";
import {
  bash,
  getReturnsHistory,
  getInventoryStock,
  getSalesAnalytics,
  getSupportTickets,
  searchProducts,
  getAllCategories,
} from "@/lib/tools";
import { createOrGetSandbox, SANDBOX_NAME } from "@/lib/sandbox";

export async function readMemories() {
  const sandbox = await createOrGetSandbox(SANDBOX_NAME);
  const buffer = await sandbox.readFileToBuffer({ path: "memories.md" });
  return buffer ? new TextDecoder().decode(buffer) : null;
}

export const backOfficeInstructions = `You are the back-office assistant for the Vercel swag store. You have read-only access to returns, inventory, sales, and support tickets through tools, and a persistent bash sandbox for computation.

## Tools
- Returns: getReturnsHistory
- Inventory: getInventoryStock
- Sales: getSalesAnalytics
- Support: getSupportTickets
- Computation: bash (persistent sandbox)

## How to answer
- All prices, refund amounts, and revenues are in cents. Convert to dollars in user-facing answers (e.g. 2800 → $28.00).
- Be concrete: name specific products, give specific numbers, and state the date range you used.
- If the user gives a vague time window ("this month", "recently"), pick a sensible range, state it explicitly, and proceed.
- For multi-step inference (return rates, day-over-day trends, spike detection, joins between sales and returns), prefer the bash tool: write fetched JSON to /tmp with a heredoc, then run python3 (stdlib only, no pandas) to compute. Don't eyeball aggregates over more than ~10 rows.
- Keep answers short and scannable. Lead with the headline number or finding, then a brief breakdown.
- Never promise to change anything in the store, you have read-only tools.`;

export async function adminChatFlow(messages: UIMessage[]) {
  "use workflow";

  const modelMessages = await convertToModelMessages(messages);

  const memories = await readMemories();

  const agent = new WorkflowAgent({
    model: "anthropic/claude-sonnet-5",
    instructions: [
      backOfficeInstructions,
      "",
      "## Memory protocol",
      "You have a memories.md file at /vercel/sandbox/memories.md. Append to it with the bash tool.",
      "",
      memories
        ? `## Current memories\n\n${memories}`
        : "No memories yet.",
    ].join("\n"),
    tools: {
      bash,
      getReturnsHistory,
      getInventoryStock,
      getSalesAnalytics,
      getSupportTickets,
      searchProducts,
      getAllCategories,
    },
  });

  await agent.stream({
    messages: modelMessages,
    writable: getWritable<ModelCallStreamPart>(),
  });
}
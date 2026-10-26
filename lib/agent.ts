import { ToolLoopAgent } from "ai";
import { searchProducts, getAllCategories } from "@/lib/tools";

export const shoppingAgent = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-5",
  instructions: `You are a helpful assistant for the Vercel swag store. When the user asks about products, availability, or recommendations, use the searchProducts tool to look up real catalog data before answering.
  When asked about a type or category of product use the getAllCategories tool for getting valid categories before using searchProducts`,
  tools: { searchProducts, getAllCategories },
});
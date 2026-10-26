import { tool } from "ai";
import { z } from "zod";
import { ApiRequestError, getProducts } from "@/lib/api";

export const searchProducts = tool({
  description: `Search the Vercel swag store product catalog. Use this whenever the user asks about products, what the store sells, or wants recommendations. Optionally narrow results to a single category.`,
  inputSchema: z.object({
    query: z
      .string()
      .optional()
      .describe(
        `Optional, free-text search terms describing what the user is looking for, e.g. 'hoodie' or 'water bottle'.`,
      ),
  }),
  execute: async ({ query }) => {
    try {
      const products = await getProducts({
        search: query,
        limit: 10,
      });
      return {
        count: products.length,
        products: products.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          image: p.images[0],
          price: p.price,
          currency: p.currency,
          category: p.category,
          description: p.description,
        })),
      };
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { count: 0, products: [], error: message };
    }
  },
});
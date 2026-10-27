import { tool } from "ai";
import { z } from "zod";
import { ApiRequestError, createReturn, getCategories, getOrder, getProducts, getProductById, getProductStock, preauthorizeRefund, notifyReturnInProcess } from "@/lib/api";

export const searchProducts = tool({
  description: `Broad lookup of the Vercel swag store catalog. Use this when the user is browsing, comparing, or asking for recommendations across several items (e.g. "what hoodies do you have?"). Returns lightweight summaries only (no stock, sizes, or extra images). If the user asks about ONE specific item, find its id here if you don't have it, then call getProductDetails.`,
  inputSchema: z.object({
    query: z
      .string()
      .optional()
      .describe(
        `Optional free-text search terms describing what the user is looking for, e.g. 'hoodie' or 'water bottle'.`,
      ),
    category: z
      .string()
      .optional()
      .describe(
        `Optional category slug to filter results. Only set this when the user clearly wants a specific category. Use the getAllCategories tool to get all valid categories.`,
      ),
  }),
  execute: async ({ query, category }) => {
    try {
      const products = await getProducts({
        search: query,
        category,
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

export const getProductDetails = tool({
  description: `Get the full details of ONE specific product: description, price, all images, available sizes/variants, live stock, and related products. Use this whenever the user asks about a particular item (e.g. "Tell me more about the black hoodie", "Is the water bottle in stock?", "What sizes does it come in?"). Do NOT use it for browsing or comparing many items; use searchProducts for that. Requires a product id; if you only have a name, call searchProducts first to find the id.`,
  inputSchema: z.object({
    productId: z
      .string()
      .describe(`The product id, as returned by searchProducts.`),
  }),
  execute: async ({ productId }) => {
    try {
      const [product, stock] = await Promise.all([
        getProductById(productId),
        getProductStock(productId),
      ]);

      // Related products: same category, excluding this one
      let related: { id: string; name: string; image: string; price: number }[] = [];
      try {
        const sameCategory = await getProducts({ category: product.category, limit: 4 });
        related = sameCategory
          .filter((p) => p.id !== product.id)
          .slice(0, 3)
          .map((p) => ({ id: p.id, name: p.name, image: p.images[0], price: p.price }));
      } catch {
        // related products are optional; ignore failures
      }

      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price,
        currency: product.currency,
        category: product.category,
        images: product.images,
        image: product.images[0],

        related,
      };
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { error: message };
    }
  },
});

export const getAllCategories = tool({
  description: `List every product category available in the Vercel swag store, along with the number of products in each. Use this when the user asks what categories exist, what kinds of products are sold, or wants to browse the store at a high level.`,
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const categories = await getCategories();
      return {
        count: categories.length,
        categories: categories.map((c) => ({
          slug: c.slug,
          name: c.name,
          productCount: c.productCount,
        })),
      };
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { count: 0, categories: [], error: message };
    }
  },
});

export const returnOrder = tool({
  description: `File a return for one of the user's past orders. The user must provide an order ID and a reason. Example order IDs: 11111, 22222, 33333.`,
  inputSchema: z.object({
    orderId: z
      .string()
      .describe("The order ID the user wants to return."),
    reason: z
      .string()
      .min(10)
      .max(500)
      .describe("Why the user is returning the order."),
  }),
  execute: async ({ orderId, reason }) => {
    try {
      const order = await getOrder(orderId);
      await notifyReturnInProcess(orderId);
      await preauthorizeRefund(orderId);
      const filed = await createReturn({
        orderId: order.id,
        items: order.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
        })),
        reason,
      });
      return { returnId: filed.id, status: filed.status };
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { error: message };
    }
  },
});
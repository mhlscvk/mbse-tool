import { defineCollection, z } from 'astro:content';

const vakaSchema = z.object({
  order: z.number(),
  tip: z.string(),
  title: z.string(),
  hook: z.string(),
  subtitle: z.string(),
  ctaType: z.enum(['full', 'soft', 'none']),
  ctaText: z.string().optional(),
});

export const collections = {
  vakalar: defineCollection({ type: 'content', schema: vakaSchema }),
};

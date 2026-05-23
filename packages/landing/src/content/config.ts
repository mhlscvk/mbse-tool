import { defineCollection, z } from 'astro:content';

const blogSchema = z.object({
  title: z.string(),
  description: z.string(),
  publishedAt: z.date(),
  updatedAt: z.date().optional(),
  author: z.string().default('Muhlis Çevik'),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
  coverImage: z.string().optional(),
});

export const collections = {
  'blog-tr': defineCollection({ type: 'content', schema: blogSchema }),
  'blog-en': defineCollection({ type: 'content', schema: blogSchema }),
};

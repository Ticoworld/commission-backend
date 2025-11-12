-- Add nullable unique slug to News for SEO-friendly URLs
ALTER TABLE "News" ADD COLUMN IF NOT EXISTS "slug" TEXT;

-- Create a unique index on slug; allows multiple NULLs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'News_slug_key'
  ) THEN
    CREATE UNIQUE INDEX "News_slug_key" ON "News"("slug");
  END IF;
END $$;
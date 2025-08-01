-- CreateEnum
CREATE TYPE "public"."VoteType" AS ENUM ('UPVOTE', 'DOWNVOTE');

-- AlterEnum
ALTER TYPE "public"."Visibility" ADD VALUE 'TEAM';

-- AlterTable
ALTER TABLE "public"."prompts" ADD COLUMN     "downvote_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "upvote_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "public"."prompt_votes" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "prompt_id" INTEGER NOT NULL,
    "vote_type" "public"."VoteType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prompt_votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "prompt_votes_user_id_prompt_id_key" ON "public"."prompt_votes"("user_id", "prompt_id");

-- CreateIndex
CREATE INDEX "prompts_upvote_count_idx" ON "public"."prompts"("upvote_count");

-- AddForeignKey
ALTER TABLE "public"."prompt_votes" ADD CONSTRAINT "prompt_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prompt_votes" ADD CONSTRAINT "prompt_votes_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

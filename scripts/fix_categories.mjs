// Fix miscategorized attentions and re-tag their posts
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envPath = new URL("../.env.local", import.meta.url).pathname;
const envContent = readFileSync(envPath, "utf-8");
const vars = {};
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) vars[match[1].trim()] = match[2].trim();
}

const supabase = createClient(
  vars.NEXT_PUBLIC_SUPABASE_URL,
  vars.SUPABASE_SERVICE_ROLE_KEY || vars.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

const CATEGORY_TOPIC_MAP = {
  economics: ["economy", "interest-rates", "stock-market", "investing"],
  crypto: ["bitcoin", "blockchain", "ethereum", "etf"],
  ai: ["ai", "machine-learning", "openai", "technology"],
  politics: ["politics", "election", "geopolitics", "diplomacy"],
  sports: ["baseball", "kbo", "soccer", "esports", "nba"],
  entertainment: ["entertainment", "kpop", "kdrama", "movies"],
};

const FIXES = [
  { titleContains: "Strait of Hormuz", correctCategory: "politics", extraTopicSlugs: ["geopolitics", "diplomacy", "oil"] },
  { titleContains: "AI be able to gen", correctCategory: "ai", extraTopicSlugs: ["ai", "machine-learning", "technology", "openai"] },
  { titleContains: "FIFA World Cup", correctCategory: "sports", extraTopicSlugs: ["soccer", "world-cup"] },
  { titleContains: "NBA Champion", correctCategory: "sports", extraTopicSlugs: ["nba", "nba-playoffs"] },
];

async function main() {
  const { data: clusters } = await supabase.from("attention_clusters").select("id, title, category");
  const { data: topics } = await supabase.from("topics").select("id, slug, canonical_label");
  const topicBySlug = Object.fromEntries((topics || []).map((t) => [t.slug, t]));

  for (const fix of FIXES) {
    const cluster = clusters?.find((c) => c.title?.includes(fix.titleContains));
    if (!cluster) { console.log(`Skip: "${fix.titleContains}" not found`); continue; }

    // 1. Update category
    if (cluster.category !== fix.correctCategory) {
      await supabase.from("attention_clusters").update({ category: fix.correctCategory }).eq("id", cluster.id);
      console.log(`✅ Fixed category: "${cluster.title?.slice(0, 40)}" ${cluster.category} -> ${fix.correctCategory}`);
    }

    // 2. Delete old attention topic tags
    await supabase.from("content_topics").delete().eq("target_type", "attention").eq("target_id", cluster.id);

    // 3. Insert correct attention topic tags
    const attInserts = [];
    const baseSlugs = CATEGORY_TOPIC_MAP[fix.correctCategory] || [];
    const allSlugs = [...new Set([...baseSlugs, ...fix.extraTopicSlugs])];
    for (const slug of allSlugs) {
      if (topicBySlug[slug]) {
        attInserts.push({
          topic_id: topicBySlug[slug].id,
          target_type: "attention",
          target_id: cluster.id,
          source: "system",
          confidence: 1.0,
        });
      }
    }
    if (attInserts.length > 0) {
      await supabase.from("content_topics").insert(attInserts);
      console.log(`  Attention topics: ${allSlugs.join(", ")}`);
    }

    // 4. Fix posts under this attention
    const { data: posts } = await supabase
      .from("posts")
      .select("id")
      .eq("attention_cluster_id", cluster.id);

    if (posts && posts.length > 0) {
      const postIds = posts.map((p) => p.id);
      // Delete old post topic tags
      await supabase.from("content_topics").delete().eq("target_type", "post").in("target_id", postIds);

      // Insert correct post topic tags
      const postInserts = [];
      for (const post of posts) {
        const topicIds = allSlugs.slice(0, 3).map((s) => topicBySlug[s]?.id).filter(Boolean);
        for (const topicId of topicIds) {
          postInserts.push({
            topic_id: topicId,
            target_type: "post",
            target_id: post.id,
            source: "system",
            confidence: 0.9,
          });
        }
      }
      if (postInserts.length > 0) {
        await supabase.from("content_topics").insert(postInserts);
        console.log(`  Fixed ${posts.length} posts with ${postInserts.length} tags`);
      }
    }
  }
  console.log("\n✅ All fixes applied.");
}

main().catch(console.error);

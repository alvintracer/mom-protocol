// Script to add topic tags to the 21 generated posts.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// Load env
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

// Map attention category to matching topic slugs
const CATEGORY_TOPIC_MAP = {
  economics: ["economy", "interest-rates", "federal-reserve", "inflation", "stock-market"],
  crypto: ["bitcoin", "blockchain", "ethereum", "etf", "crypto-regulation"],
  ai: ["ai", "machine-learning", "openai", "technology"],
  politics: ["politics", "election", "geopolitics", "us-politics"],
  sports: ["baseball", "kbo", "soccer", "esports"],
  entertainment: ["entertainment", "kpop", "kdrama", "movies", "music"],
};

async function main() {
  // 1. Get all attention clusters
  const { data: clusters, error: clusterErr } = await supabase
    .from("attention_clusters")
    .select("id, title, category, slug");
  if (clusterErr) { console.error("Cluster error:", clusterErr); return; }
  console.log(`Clusters: ${clusters.length}`);

  // 2. Get topics
  const { data: topics } = await supabase.from("topics").select("id, slug, canonical_label");
  const topicBySlug = Object.fromEntries((topics || []).map((t) => [t.slug, t]));
  console.log(`Topics available: ${topics?.length}`);

  // 3. Get posts with attention_cluster_id
  const { data: posts, error: postErr } = await supabase
    .from("posts")
    .select("id, original_body, attention_cluster_id, selected_outcome")
    .not("attention_cluster_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (postErr) { console.error("Post error:", postErr); return; }
  console.log(`Posts with attention: ${posts.length}`);

  // 4. Check existing post-topic links
  const postIds = posts.map((p) => p.id);
  const { data: existing } = await supabase
    .from("content_topics")
    .select("target_id")
    .eq("target_type", "post")
    .in("target_id", postIds);
  const tagged = new Set((existing || []).map((e) => e.target_id));
  const untagged = posts.filter((p) => !tagged.has(p.id));
  console.log(`Already tagged: ${tagged.size}, Need tagging: ${untagged.length}`);

  // 5. Also ensure attentions have topics
  const clusterIds = clusters.map((c) => c.id);
  const { data: existingAttTopics } = await supabase
    .from("content_topics")
    .select("target_id")
    .eq("target_type", "attention")
    .in("target_id", clusterIds);
  const attTagged = new Set((existingAttTopics || []).map((e) => e.target_id));

  const inserts = [];

  // Tag attentions first
  for (const cluster of clusters) {
    if (attTagged.has(cluster.id)) continue;
    const slugs = CATEGORY_TOPIC_MAP[cluster.category] || [];
    // Also check title for keyword matches
    const titleLower = (cluster.title || "").toLowerCase();

    const matchedTopicIds = new Set();
    for (const slug of slugs) {
      if (topicBySlug[slug]) matchedTopicIds.add(topicBySlug[slug].id);
    }
    // Title keyword matching
    for (const t of topics || []) {
      if (titleLower.includes(t.canonical_label.toLowerCase()) && t.canonical_label.length > 2) {
        matchedTopicIds.add(t.id);
      }
    }

    for (const topicId of matchedTopicIds) {
      inserts.push({
        topic_id: topicId,
        target_type: "attention",
        target_id: cluster.id,
        source: "system",
        confidence: 1.0,
      });
    }
    const matchedLabels = [...matchedTopicIds].map((id) => topics.find((t) => t.id === id)?.canonical_label).join(", ");
    console.log(`  Attention "${cluster.title?.slice(0, 40)}" (${cluster.category}) -> ${matchedTopicIds.size} topics: ${matchedLabels}`);
  }

  // Tag posts
  for (const post of untagged) {
    const cluster = clusters.find((c) => c.id === post.attention_cluster_id);
    if (!cluster) continue;

    const slugs = CATEGORY_TOPIC_MAP[cluster.category] || [];
    const titleLower = (cluster.title || "").toLowerCase();
    const bodyLower = (post.original_body || "").toLowerCase();

    const matchedTopicIds = new Set();
    for (const slug of slugs) {
      if (topicBySlug[slug]) matchedTopicIds.add(topicBySlug[slug].id);
    }
    // Title + body keyword matching
    for (const t of topics || []) {
      const label = t.canonical_label.toLowerCase();
      if (label.length > 2 && (titleLower.includes(label) || bodyLower.includes(label))) {
        matchedTopicIds.add(t.id);
      }
    }

    // Pick top 3 most relevant
    const topicIds = [...matchedTopicIds].slice(0, 3);
    for (const topicId of topicIds) {
      inserts.push({
        topic_id: topicId,
        target_type: "post",
        target_id: post.id,
        source: "system",
        confidence: 0.9,
      });
    }
    const labels = topicIds.map((id) => topics.find((t) => t.id === id)?.canonical_label).join(", ");
    console.log(`  Post "${post.original_body?.slice(0, 35)}..." -> ${topicIds.length} topics: ${labels}`);
  }

  if (inserts.length > 0) {
    console.log(`\nInserting ${inserts.length} topic tags...`);
    const { error } = await supabase.from("content_topics").insert(inserts);
    if (error) {
      console.error("Insert error:", error);
    } else {
      console.log(`✅ Done! ${inserts.length} tags inserted.`);
    }
  } else {
    console.log("\nNo tags needed.");
  }
}

main().catch(console.error);

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase URL or Key");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log("Fetching users...");
  const { data: { users }, error: userErr } = await supabase.auth.admin.listUsers();
  
  if (userErr) {
    console.error("Error fetching users:", userErr);
    return;
  }
  
  const userIds = users.slice(0, 4).map(u => u.id);
  if (userIds.length === 0) {
    console.log("No users found. Please sign up users first.");
    return;
  }
  
  console.log(`Found ${userIds.length} users. User IDs:`, userIds);
  
  // Data for events/attentions
  const seedData = [
    {
      topic: "US Election 2024",
      question: "Who will win the 2024 US Presidential Election?",
      slug: "us-election-2024-winner",
      title: "2024년 미국 대통령 선거 승자는?",
      category: "politics",
      outcomes: ["Trump", "Biden", "Kennedy", "Other"],
      bond: 100,
      posts: [
        { text: "트럼프 당선 확률이 점점 올라가는 듯. 폴리마켓도 60% 넘었네.", outcome: "Trump" },
        { text: "이번 대선은 경합주 결과가 모든 걸 결정할 것 같아요.", outcome: "Biden" },
        { text: "경제 지표가 어떻게 나오느냐에 따라 바이든의 지지율도 달라질겁니다.", outcome: "Biden" }
      ]
    },
    {
      topic: "Bitcoin",
      question: "Will Bitcoin reach $100k by the end of 2024?",
      slug: "btc-100k-2024",
      title: "2024년 말까지 비트코인 10만 달러 돌파할까?",
      category: "crypto",
      outcomes: ["YES", "NO"],
      bond: 50,
      posts: [
        { text: "반감기 지나고 나서 연말 불장 기대해봅니다. 10만 달러 가즈아!", outcome: "YES" },
        { text: "최근 기관 매수세 보면 불가능한 수치도 아니라고 봅니다.", outcome: "YES" },
        { text: "현물 ETF 유입량이 핵심일 듯. 아직은 조금 부족해보이네요.", outcome: "NO" }
      ]
    },
    {
      topic: "AI Model",
      question: "Will OpenAI release GPT-5 before December 2024?",
      slug: "openai-gpt5-2024",
      title: "OpenAI가 2024년 12월 이전에 GPT-5를 출시할까?",
      category: "ai",
      outcomes: ["YES", "NO"],
      bond: 25,
      posts: [
        { text: "Sam Altman 인터뷰 보니까 올해 안에는 힘들 거라는 뉘앙스던데요.", outcome: "NO" },
        { text: "구글 제미나이 1.5 프로가 너무 잘나와서 급하게라도 출시할 수 있습니다.", outcome: "YES" },
        { text: "지금 컴퓨팅 자원 확보하는 거 보면 충분히 가능성 있어보입니다.", outcome: "YES" }
      ]
    },
    {
      topic: "LCK",
      question: "Will T1 win the 2024 LCK Summer Split?",
      slug: "t1-lck-summer-2024",
      title: "T1이 2024 LCK 서머 스플릿 우승을 차지할까?",
      category: "esports",
      outcomes: ["YES", "NO"],
      bond: 10,
      posts: [
        { text: "페이커 손목 상태가 관건일 듯. 폼만 돌아오면 무조건 우승.", outcome: "YES" },
        { text: "젠지 폼이 워낙 좋아서 쉽지 않아 보입니다.", outcome: "NO" },
        { text: "서머의 T1은 다릅니다. 결승 직행 예상합니다.", outcome: "YES" }
      ]
    }
  ];

  for (let i = 0; i < seedData.length; i++) {
    const data = seedData[i];
    const creatorId = userIds[i % userIds.length];
    
    console.log(`\nInserting event & cluster for: ${data.slug}`);
    
    // Cleanup existing first
    await supabase.from('attention_clusters').delete().eq('slug', data.slug);
    await supabase.from('events').delete().eq('slug', data.slug);

    // 1. Create Event
    const { data: event, error: eventErr } = await supabase.from('events').insert({
      slug: data.slug,
      title: data.question,
      description: `A prediction event about ${data.topic}`,
      category: data.category,
      starts_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(), // 30 days from now
      created_by: creatorId,
      status: 'open'
    }).select().single();
    
    if (eventErr) {
      console.error("Event insert error:", eventErr);
      continue;
    }

    // 2. Create AIO Rule
    const { data: rule, error: ruleErr } = await supabase.from('attention_rules').insert({
      event_id: event.id,
      title: `${data.topic} AIO Rule`,
      question: data.question,
      resolution_criteria: `Resolves based on official announcement or consensus among top 3 news sources.`,
      supported_outcomes: data.outcomes,
      challenge_period_seconds: 259200, // 72 hours
      min_evidence_count: 1,
      bond_amount: data.bond,
      status: 'active',
      created_by: creatorId
    }).select().single();

    if (ruleErr) {
      console.error("Rule insert error:", ruleErr);
    }

    // 3. Create Attention Cluster
    const { data: cluster, error: clusterErr } = await supabase.from('attention_clusters').insert({
      slug: data.slug,
      title: data.title,
      description: data.question,
      category: data.category,
      canonical_event_id: event.id,
      created_by: creatorId,
      attention_score: Math.floor(Math.random() * 1000) + 100,
      post_count: data.posts.length,
      comment_count: Math.floor(Math.random() * 10)
    }).select().single();

    if (clusterErr) {
      console.error("Cluster insert error:", clusterErr);
      continue;
    }

    // 4. Create Posts
    for (let j = 0; j < data.posts.length; j++) {
      const postText = data.posts[j].text;
      const postOutcome = data.posts[j].outcome;
      const authorId = userIds[(i + j + 1) % userIds.length];
      
      const { data: post, error: postErr } = await supabase.from('posts').insert({
        user_id: authorId,
        attention_cluster_id: cluster.id,
        original_body: postText,
        original_language: 'ko',
        selected_outcome: postOutcome || null
      }).select().single();
      
      if (postErr) {
        console.error("Post insert error:", postErr);
      }
    }

    // 5. Create Assertion (for one of the events to show up in Oracle Dashboard)
    if (i === 0 || i === 2) {
      const proposerId = userIds[(i + 2) % userIds.length];
      
      const { data: assertion, error: assertionErr } = await supabase.from('aio_assertions').insert({
        event_id: event.id,
        rule_id: rule.id,
        proposer_id: proposerId,
        claim_text: i === 0 ? "Polymarket shows Trump winning probability over 60%." : "OpenAI officially confirmed GPT-5 is delayed to 2025.",
        asserted_outcome: i === 0 ? "Trump" : "NO",
        bond_amount: rule.bond_amount,
        status: i === 0 ? 'llm_verified' : 'challenge_period',
        challenge_ends_at: i === 0 ? null : new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString()
      }).select().single();

      if (!assertionErr && assertion) {
        // Insert evidence
        await supabase.from('aio_evidence_items').insert({
          assertion_id: assertion.id,
          submitted_by: proposerId,
          url: i === 0 ? "https://polymarket.com/elections" : "https://techcrunch.com/openai-gpt5-delay",
          publisher_domain: i === 0 ? "polymarket.com" : "techcrunch.com",
          publisher_trust_weight: 0.85,
          content_hash: "abc123hash",
          captured_at: new Date().toISOString()
        });

        // Insert LLM verification
        await supabase.from('aio_llm_verifications').insert([
          {
            assertion_id: assertion.id,
            model_id: "gpt-4o",
            provider: "openai",
            verdict: "supports",
            confidence: 90,
            reasoning_summary: i === 0 ? "Evidence directly shows the claim is supported by the data on Polymarket." : "TechCrunch article explicitly states the delay.",
            prompt_hash: "hash1"
          },
          {
            assertion_id: assertion.id,
            model_id: "claude-3-opus",
            provider: "anthropic",
            verdict: "supports",
            confidence: 88,
            reasoning_summary: "Agrees with the primary source.",
            prompt_hash: "hash2"
          }
        ]);
        
        // Insert Challenge for the 2nd one
        if (i === 2) {
          const challengerId = userIds[(i + 3) % userIds.length];
          await supabase.from('aio_challenges').insert({
            assertion_id: assertion.id,
            challenger_id: challengerId,
            counter_claim_text: "Sam Altman denied the delay on Twitter just yesterday.",
            counter_outcome: "YES",
            bond_amount: 25,
            status: "accepted"
          });
          
          await supabase.from('aio_evidence_items').insert({
            assertion_id: assertion.id,
            challenge_id: null, // Depending on schema
            submitted_by: challengerId,
            url: "https://twitter.com/sama/status/123",
            publisher_domain: "twitter.com",
            publisher_trust_weight: 0.9,
            content_hash: "def456hash",
            captured_at: new Date().toISOString()
          });
        }
      }
    }
    
    // 6. Create some prediction orders for fun
    for (let k = 0; k < 2; k++) {
      await supabase.from('prediction_orders').insert({
        event_id: event.id,
        user_id: userIds[(i + k) % userIds.length],
        outcome: data.outcomes[k % data.outcomes.length],
        shares: Math.floor(Math.random() * 100) + 10,
        price_per_share: Math.floor(Math.random() * 90) + 5,
        total_cost: 0,
        order_type: 'buy',
        status: 'filled'
      });
    }
  }

  console.log("\nSeed completed!");
}

seed().catch(console.error);

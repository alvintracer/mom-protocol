-- =============================================================================
-- Seed ~200 curated topics for auto-tagging system
-- Topics have multilingual labels (ko/en/es) in JSONB
-- =============================================================================

BEGIN;

-- Helper: upsert topic by slug
INSERT INTO public.topics (slug, kind, canonical_label, labels, description) VALUES
-- ═══ CATEGORY: Crypto & Blockchain ═══
('blockchain',       'category', 'Blockchain',       '{"ko":"블록체인","en":"Blockchain","es":"Blockchain"}', NULL),
('bitcoin',          'entity',   'Bitcoin',           '{"ko":"비트코인","en":"Bitcoin","es":"Bitcoin"}', NULL),
('ethereum',         'entity',   'Ethereum',          '{"ko":"이더리움","en":"Ethereum","es":"Ethereum"}', NULL),
('solana',           'entity',   'Solana',            '{"ko":"솔라나","en":"Solana","es":"Solana"}', NULL),
('ripple',           'entity',   'Ripple',            '{"ko":"리플","en":"Ripple","es":"Ripple"}', NULL),
('defi',             'ai_keyword','DeFi',             '{"ko":"디파이","en":"DeFi","es":"DeFi"}', NULL),
('nft',              'ai_keyword','NFT',              '{"ko":"NFT","en":"NFT","es":"NFT"}', NULL),
('web3',             'ai_keyword','Web3',             '{"ko":"웹3","en":"Web3","es":"Web3"}', NULL),
('dao',              'ai_keyword','DAO',              '{"ko":"DAO","en":"DAO","es":"DAO"}', NULL),
('stablecoin',       'ai_keyword','Stablecoin',       '{"ko":"스테이블코인","en":"Stablecoin","es":"Stablecoin"}', NULL),
('altcoin',          'ai_keyword','Altcoin',          '{"ko":"알트코인","en":"Altcoin","es":"Altcoin"}', NULL),
('mining',           'ai_keyword','Mining',           '{"ko":"채굴","en":"Mining","es":"Minería"}', NULL),
('staking',          'ai_keyword','Staking',          '{"ko":"스테이킹","en":"Staking","es":"Staking"}', NULL),
('airdrop',          'ai_keyword','Airdrop',          '{"ko":"에어드롭","en":"Airdrop","es":"Airdrop"}', NULL),
('token-launch',     'ai_keyword','Token Launch',     '{"ko":"토큰 출시","en":"Token Launch","es":"Lanzamiento de token"}', NULL),
('layer2',           'ai_keyword','Layer 2',          '{"ko":"레이어2","en":"Layer 2","es":"Capa 2"}', NULL),
('crypto-regulation','ai_keyword','Crypto Regulation','{"ko":"암호화폐 규제","en":"Crypto Regulation","es":"Regulación cripto"}', NULL),
('exchange',         'ai_keyword','Exchange',         '{"ko":"거래소","en":"Exchange","es":"Exchange"}', NULL),
('wallet',           'ai_keyword','Wallet',           '{"ko":"지갑","en":"Wallet","es":"Billetera"}', NULL),
('metaverse',        'ai_keyword','Metaverse',        '{"ko":"메타버스","en":"Metaverse","es":"Metaverso"}', NULL),
('gamefi',           'ai_keyword','GameFi',           '{"ko":"게임파이","en":"GameFi","es":"GameFi"}', NULL),
('socialfi',         'ai_keyword','SocialFi',         '{"ko":"소셜파이","en":"SocialFi","es":"SocialFi"}', NULL),

-- ═══ CATEGORY: Investing & Economy ═══
('investing',        'category', 'Investing',         '{"ko":"투자","en":"Investing","es":"Inversión"}', NULL),
('economy',          'category', 'Economy',           '{"ko":"경제","en":"Economy","es":"Economía"}', NULL),
('stock-market',     'ai_keyword','Stock Market',     '{"ko":"주식시장","en":"Stock Market","es":"Mercado bursátil"}', NULL),
('real-estate',      'ai_keyword','Real Estate',      '{"ko":"부동산","en":"Real Estate","es":"Bienes raíces"}', NULL),
('commodities',      'ai_keyword','Commodities',      '{"ko":"원자재","en":"Commodities","es":"Materias primas"}', NULL),
('forex',            'ai_keyword','Forex',            '{"ko":"외환","en":"Forex","es":"Forex"}', NULL),
('interest-rates',   'ai_keyword','Interest Rates',   '{"ko":"금리","en":"Interest Rates","es":"Tasas de interés"}', NULL),
('inflation',        'ai_keyword','Inflation',        '{"ko":"인플레이션","en":"Inflation","es":"Inflación"}', NULL),
('recession',        'ai_keyword','Recession',        '{"ko":"경기침체","en":"Recession","es":"Recesión"}', NULL),
('federal-reserve',  'entity',   'Federal Reserve',   '{"ko":"연준","en":"Federal Reserve","es":"Reserva Federal"}', NULL),
('earnings',         'ai_keyword','Earnings',         '{"ko":"실적발표","en":"Earnings","es":"Resultados financieros"}', NULL),
('ipo',              'ai_keyword','IPO',              '{"ko":"IPO","en":"IPO","es":"OPI"}', NULL),
('etf',              'ai_keyword','ETF',              '{"ko":"ETF","en":"ETF","es":"ETF"}', NULL),
('venture-capital',  'ai_keyword','Venture Capital',  '{"ko":"벤처캐피탈","en":"Venture Capital","es":"Capital de riesgo"}', NULL),
('startups',         'ai_keyword','Startups',         '{"ko":"스타트업","en":"Startups","es":"Startups"}', NULL),
('gold',             'entity',   'Gold',              '{"ko":"금","en":"Gold","es":"Oro"}', NULL),
('oil',              'entity',   'Oil',               '{"ko":"원유","en":"Oil","es":"Petróleo"}', NULL),

-- ═══ CATEGORY: Technology ═══
('technology',       'category', 'Technology',        '{"ko":"기술","en":"Technology","es":"Tecnología"}', NULL),
('ai',               'ai_keyword','AI',               '{"ko":"인공지능","en":"AI","es":"IA"}', NULL),
('machine-learning', 'ai_keyword','Machine Learning', '{"ko":"머신러닝","en":"Machine Learning","es":"Aprendizaje automático"}', NULL),
('robotics',         'ai_keyword','Robotics',         '{"ko":"로봇공학","en":"Robotics","es":"Robótica"}', NULL),
('cybersecurity',    'ai_keyword','Cybersecurity',    '{"ko":"사이버보안","en":"Cybersecurity","es":"Ciberseguridad"}', NULL),
('cloud-computing',  'ai_keyword','Cloud Computing',  '{"ko":"클라우드","en":"Cloud Computing","es":"Computación en la nube"}', NULL),
('semiconductors',   'ai_keyword','Semiconductors',   '{"ko":"반도체","en":"Semiconductors","es":"Semiconductores"}', NULL),
('smartphones',      'ai_keyword','Smartphones',      '{"ko":"스마트폰","en":"Smartphones","es":"Smartphones"}', NULL),
('ev',               'ai_keyword','Electric Vehicles','{"ko":"전기차","en":"Electric Vehicles","es":"Vehículos eléctricos"}', NULL),
('space',            'ai_keyword','Space',            '{"ko":"우주","en":"Space","es":"Espacio"}', NULL),
('quantum-computing','ai_keyword','Quantum Computing','{"ko":"양자컴퓨팅","en":"Quantum Computing","es":"Computación cuántica"}', NULL),

-- ═══ CATEGORY: Tech Companies (Entities) ═══
('apple',            'entity',   'Apple',             '{"ko":"애플","en":"Apple","es":"Apple"}', NULL),
('google',           'entity',   'Google',            '{"ko":"구글","en":"Google","es":"Google"}', NULL),
('microsoft',        'entity',   'Microsoft',         '{"ko":"마이크로소프트","en":"Microsoft","es":"Microsoft"}', NULL),
('nvidia',           'entity',   'NVIDIA',            '{"ko":"엔비디아","en":"NVIDIA","es":"NVIDIA"}', NULL),
('tesla',            'entity',   'Tesla',             '{"ko":"테슬라","en":"Tesla","es":"Tesla"}', NULL),
('amazon',           'entity',   'Amazon',            '{"ko":"아마존","en":"Amazon","es":"Amazon"}', NULL),
('meta',             'entity',   'Meta',              '{"ko":"메타","en":"Meta","es":"Meta"}', NULL),
('openai',           'entity',   'OpenAI',            '{"ko":"OpenAI","en":"OpenAI","es":"OpenAI"}', NULL),
('samsung',          'entity',   'Samsung',           '{"ko":"삼성","en":"Samsung","es":"Samsung"}', NULL),

-- ═══ CATEGORY: Gaming ═══
('gaming',           'category', 'Gaming',            '{"ko":"게임","en":"Gaming","es":"Gaming"}', NULL),
('esports',          'ai_keyword','Esports',          '{"ko":"e스포츠","en":"Esports","es":"Esports"}', NULL),
('playstation',      'entity',   'PlayStation',       '{"ko":"플레이스테이션","en":"PlayStation","es":"PlayStation"}', NULL),
('xbox',             'entity',   'Xbox',              '{"ko":"엑스박스","en":"Xbox","es":"Xbox"}', NULL),
('nintendo',         'entity',   'Nintendo',          '{"ko":"닌텐도","en":"Nintendo","es":"Nintendo"}', NULL),
('pc-gaming',        'ai_keyword','PC Gaming',        '{"ko":"PC 게임","en":"PC Gaming","es":"PC Gaming"}', NULL),
('mobile-gaming',    'ai_keyword','Mobile Gaming',    '{"ko":"모바일 게임","en":"Mobile Gaming","es":"Juegos móviles"}', NULL),
('mmorpg',           'ai_keyword','MMORPG',           '{"ko":"MMORPG","en":"MMORPG","es":"MMORPG"}', NULL),
('fps',              'ai_keyword','FPS',              '{"ko":"FPS","en":"FPS","es":"FPS"}', NULL),
('game-review',      'ai_keyword','Game Review',      '{"ko":"게임 리뷰","en":"Game Review","es":"Reseña de juego"}', NULL),
('indie-games',      'ai_keyword','Indie Games',      '{"ko":"인디 게임","en":"Indie Games","es":"Juegos indie"}', NULL),
('steam',            'entity',   'Steam',             '{"ko":"스팀","en":"Steam","es":"Steam"}', NULL),

-- ═══ CATEGORY: Sports — MMA/Fighting ═══
('mma',              'category', 'MMA',               '{"ko":"격투기","en":"MMA","es":"MMA"}', NULL),
('ufc',              'entity',   'UFC',               '{"ko":"UFC","en":"UFC","es":"UFC"}', NULL),
('boxing',           'ai_keyword','Boxing',            '{"ko":"복싱","en":"Boxing","es":"Boxeo"}', NULL),
('muay-thai',        'ai_keyword','Muay Thai',         '{"ko":"무에타이","en":"Muay Thai","es":"Muay Thai"}', NULL),
('jiu-jitsu',        'ai_keyword','Jiu-Jitsu',        '{"ko":"주짓수","en":"Jiu-Jitsu","es":"Jiu-Jitsu"}', NULL),
('kickboxing',       'ai_keyword','Kickboxing',       '{"ko":"킥복싱","en":"Kickboxing","es":"Kickboxing"}', NULL),
('wrestling',        'ai_keyword','Wrestling',        '{"ko":"레슬링","en":"Wrestling","es":"Lucha libre"}', NULL),

-- ═══ CATEGORY: Sports — Soccer ═══
('soccer',           'category', 'Soccer',            '{"ko":"축구","en":"Soccer","es":"Fútbol"}', NULL),
('premier-league',   'entity',   'Premier League',    '{"ko":"프리미어리그","en":"Premier League","es":"Premier League"}', NULL),
('la-liga',          'entity',   'La Liga',           '{"ko":"라리가","en":"La Liga","es":"La Liga"}', NULL),
('champions-league', 'entity',   'Champions League',  '{"ko":"챔피언스리그","en":"Champions League","es":"Champions League"}', NULL),
('k-league',         'entity',   'K League',          '{"ko":"K리그","en":"K League","es":"K League"}', NULL),
('world-cup',        'entity',   'World Cup',         '{"ko":"월드컵","en":"World Cup","es":"Copa del Mundo"}', NULL),
('serie-a',          'entity',   'Serie A',           '{"ko":"세리에A","en":"Serie A","es":"Serie A"}', NULL),
('bundesliga',       'entity',   'Bundesliga',        '{"ko":"분데스리가","en":"Bundesliga","es":"Bundesliga"}', NULL),
('mls',              'entity',   'MLS',               '{"ko":"MLS","en":"MLS","es":"MLS"}', NULL),
('liga-mx',          'entity',   'Liga MX',           '{"ko":"리가MX","en":"Liga MX","es":"Liga MX"}', NULL),
('transfer',         'ai_keyword','Transfer',         '{"ko":"이적","en":"Transfer","es":"Fichaje"}', NULL),

-- ═══ CATEGORY: Sports — NBA ═══
('nba',              'category', 'NBA',               '{"ko":"NBA","en":"NBA","es":"NBA"}', NULL),
('nba-playoffs',     'ai_keyword','NBA Playoffs',     '{"ko":"NBA 플레이오프","en":"NBA Playoffs","es":"Playoffs de la NBA"}', NULL),
('nba-draft',        'ai_keyword','NBA Draft',        '{"ko":"NBA 드래프트","en":"NBA Draft","es":"Draft de la NBA"}', NULL),
('nba-trade',        'ai_keyword','NBA Trade',        '{"ko":"NBA 트레이드","en":"NBA Trade","es":"Traspaso NBA"}', NULL),

-- ═══ CATEGORY: Sports — Baseball ═══
('baseball',         'category', 'Baseball',          '{"ko":"야구","en":"Baseball","es":"Béisbol"}', NULL),
('mlb',              'entity',   'MLB',               '{"ko":"MLB","en":"MLB","es":"MLB"}', NULL),
('kbo',              'entity',   'KBO',               '{"ko":"KBO","en":"KBO","es":"KBO"}', NULL),
('npb',              'entity',   'NPB',               '{"ko":"NPB","en":"NPB","es":"NPB"}', NULL),
('world-series',     'entity',   'World Series',      '{"ko":"월드시리즈","en":"World Series","es":"Serie Mundial"}', NULL),

-- ═══ CATEGORY: Sports — Other ═══
('tennis',           'ai_keyword','Tennis',           '{"ko":"테니스","en":"Tennis","es":"Tenis"}', NULL),
('golf',             'ai_keyword','Golf',             '{"ko":"골프","en":"Golf","es":"Golf"}', NULL),
('f1',               'entity',   'Formula 1',         '{"ko":"F1","en":"Formula 1","es":"Fórmula 1"}', NULL),
('nfl',              'entity',   'NFL',               '{"ko":"NFL","en":"NFL","es":"NFL"}', NULL),
('olympics',         'entity',   'Olympics',          '{"ko":"올림픽","en":"Olympics","es":"Juegos Olímpicos"}', NULL),
('volleyball',       'ai_keyword','Volleyball',       '{"ko":"배구","en":"Volleyball","es":"Voleibol"}', NULL),
('badminton',        'ai_keyword','Badminton',        '{"ko":"배드민턴","en":"Badminton","es":"Bádminton"}', NULL),

-- ═══ CATEGORY: Politics ═══
('politics',         'category', 'Politics',          '{"ko":"정치","en":"Politics","es":"Política"}', NULL),
('us-politics',      'ai_keyword','US Politics',      '{"ko":"미국 정치","en":"US Politics","es":"Política de EE.UU."}', NULL),
('korea-politics',   'ai_keyword','Korea Politics',   '{"ko":"한국 정치","en":"Korea Politics","es":"Política de Corea"}', NULL),
('election',         'ai_keyword','Election',         '{"ko":"선거","en":"Election","es":"Elecciones"}', NULL),
('geopolitics',      'ai_keyword','Geopolitics',      '{"ko":"지정학","en":"Geopolitics","es":"Geopolítica"}', NULL),
('diplomacy',        'ai_keyword','Diplomacy',        '{"ko":"외교","en":"Diplomacy","es":"Diplomacia"}', NULL),
('sanctions',        'ai_keyword','Sanctions',        '{"ko":"제재","en":"Sanctions","es":"Sanciones"}', NULL),
('legislation',      'ai_keyword','Legislation',      '{"ko":"입법","en":"Legislation","es":"Legislación"}', NULL),
('trump',            'entity',   'Trump',             '{"ko":"트럼프","en":"Trump","es":"Trump"}', NULL),

-- ═══ CATEGORY: Entertainment ═══
('entertainment',    'category', 'Entertainment',     '{"ko":"엔터테인먼트","en":"Entertainment","es":"Entretenimiento"}', NULL),
('movies',           'ai_keyword','Movies',           '{"ko":"영화","en":"Movies","es":"Películas"}', NULL),
('music',            'ai_keyword','Music',            '{"ko":"음악","en":"Music","es":"Música"}', NULL),
('kpop',             'ai_keyword','K-Pop',            '{"ko":"K-Pop","en":"K-Pop","es":"K-Pop"}', NULL),
('kdrama',           'ai_keyword','K-Drama',          '{"ko":"한국드라마","en":"K-Drama","es":"K-Drama"}', NULL),
('anime',            'ai_keyword','Anime',            '{"ko":"애니메이션","en":"Anime","es":"Anime"}', NULL),
('netflix',          'entity',   'Netflix',           '{"ko":"넷플릭스","en":"Netflix","es":"Netflix"}', NULL),
('youtube',          'entity',   'YouTube',           '{"ko":"유튜브","en":"YouTube","es":"YouTube"}', NULL),
('celebrity',        'ai_keyword','Celebrity',        '{"ko":"연예인","en":"Celebrity","es":"Celebridad"}', NULL),
('tv-shows',         'ai_keyword','TV Shows',         '{"ko":"TV 프로그램","en":"TV Shows","es":"Programas de TV"}', NULL),

-- ═══ CATEGORY: Lifestyle ═══
('lifestyle',        'category', 'Lifestyle',         '{"ko":"라이프스타일","en":"Lifestyle","es":"Estilo de vida"}', NULL),
('food',             'ai_keyword','Food',             '{"ko":"음식","en":"Food","es":"Comida"}', NULL),
('travel',           'ai_keyword','Travel',           '{"ko":"여행","en":"Travel","es":"Viajes"}', NULL),
('fitness',          'ai_keyword','Fitness',           '{"ko":"피트니스","en":"Fitness","es":"Fitness"}', NULL),
('fashion',          'ai_keyword','Fashion',          '{"ko":"패션","en":"Fashion","es":"Moda"}', NULL),
('health',           'ai_keyword','Health',           '{"ko":"건강","en":"Health","es":"Salud"}', NULL),
('mental-health',    'ai_keyword','Mental Health',    '{"ko":"정신건강","en":"Mental Health","es":"Salud mental"}', NULL),
('education',        'ai_keyword','Education',        '{"ko":"교육","en":"Education","es":"Educación"}', NULL),
('books',            'ai_keyword','Books',            '{"ko":"도서","en":"Books","es":"Libros"}', NULL),
('career',           'ai_keyword','Career',           '{"ko":"커리어","en":"Career","es":"Carrera profesional"}', NULL),

-- ═══ CATEGORY: Science ═══
('science',          'category', 'Science',           '{"ko":"과학","en":"Science","es":"Ciencia"}', NULL),
('climate',          'ai_keyword','Climate',          '{"ko":"기후","en":"Climate","es":"Clima"}', NULL),
('energy',           'ai_keyword','Energy',           '{"ko":"에너지","en":"Energy","es":"Energía"}', NULL),
('biotech',          'ai_keyword','Biotech',          '{"ko":"바이오텍","en":"Biotech","es":"Biotecnología"}', NULL),
('medicine',         'ai_keyword','Medicine',         '{"ko":"의학","en":"Medicine","es":"Medicina"}', NULL),
('astronomy',        'ai_keyword','Astronomy',        '{"ko":"천문학","en":"Astronomy","es":"Astronomía"}', NULL),

-- ═══ CATEGORY: Society ═══
('society',          'category', 'Society',           '{"ko":"사회","en":"Society","es":"Sociedad"}', NULL),
('environment',      'ai_keyword','Environment',      '{"ko":"환경","en":"Environment","es":"Medio ambiente"}', NULL),
('crime',            'ai_keyword','Crime',            '{"ko":"범죄","en":"Crime","es":"Crimen"}', NULL),
('opinion',          'ai_keyword','Opinion',          '{"ko":"의견","en":"Opinion","es":"Opinión"}', NULL),
('breaking-news',    'ai_keyword','Breaking News',    '{"ko":"속보","en":"Breaking News","es":"Última hora"}', NULL),
('controversy',      'ai_keyword','Controversy',      '{"ko":"논란","en":"Controversy","es":"Controversia"}', NULL),
('culture',          'ai_keyword','Culture',          '{"ko":"문화","en":"Culture","es":"Cultura"}', NULL),

-- ═══ CATEGORY: Prediction Market ═══
('prediction',       'category', 'Prediction',        '{"ko":"예측","en":"Prediction","es":"Predicción"}', NULL),
('market-analysis',  'ai_keyword','Market Analysis',  '{"ko":"시장분석","en":"Market Analysis","es":"Análisis de mercado"}', NULL),
('technical-analysis','ai_keyword','Technical Analysis','{"ko":"기술적 분석","en":"Technical Analysis","es":"Análisis técnico"}', NULL),
('on-chain-data',    'ai_keyword','On-chain Data',    '{"ko":"온체인 데이터","en":"On-chain Data","es":"Datos on-chain"}', NULL),
('price-prediction', 'ai_keyword','Price Prediction', '{"ko":"가격 예측","en":"Price Prediction","es":"Predicción de precios"}', NULL),
('whale-alert',      'ai_keyword','Whale Alert',      '{"ko":"고래 알림","en":"Whale Alert","es":"Alerta de ballena"}', NULL)

ON CONFLICT (slug) DO UPDATE SET
  labels = EXCLUDED.labels,
  canonical_label = EXCLUDED.canonical_label,
  kind = EXCLUDED.kind;

COMMIT;

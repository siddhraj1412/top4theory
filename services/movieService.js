const axios = require('axios');
const { query } = require('../config/db');

// In-memory cache for when database is not available
const memoryCache = new Map();

// =====================================================
// TIER DEFINITIONS - The 10-Level Hierarchy
// =====================================================
const TIERS = {
    1: { name: "The Casual Viewer", icon: "📺", description: "You watch movies to pass the time.", color: "#6c757d" },
    2: { name: "The Popcorn Enthusiast", icon: "🍿", description: "You enjoy the movie-going experience.", color: "#fd7e14" },
    3: { name: "The Avid Watcher", icon: "🎟️", description: "You have solid taste and watch regularly.", color: "#20c997" },
    4: { name: "The Eclectic Explorer", icon: "🌊", description: "You appreciate variety across genres.", color: "#0dcaf0" },
    5: { name: "The Dedicated Cinephile", icon: "🥃", description: "You dig deeper than most viewers.", color: "#6f42c1" },
    6: { name: "The Refined Curator", icon: "🎩", description: "Your taste is sharp and intentional.", color: "#d63384" },
    7: { name: "The Cinema Connoisseur", icon: "🍷", description: "You have excellent, well-rounded taste.", color: "#ffc107" },
    8: { name: "The Elite Cinephile", icon: "🎞️", description: "Your picks show deep film appreciation.", color: "#198754" },
    9: { name: "The Master Curator", icon: "👁️", description: "You see cinema on another level.", color: "#dc3545" },
    10: { name: "The Cinema Deity", icon: "🏆", description: "Your taste is legendary. Absolute peak.", color: "#ffd700" }
};

// =====================================================
// FAMOUS DIRECTORS DATABASE (for Auteur Detection)
// =====================================================
const AUTEUR_DIRECTORS = new Set([
    // Western/Hollywood auteurs
    'stanley kubrick', 'alfred hitchcock', 'martin scorsese', 'quentin tarantino',
    'christopher nolan', 'david lynch', 'wes anderson', 'paul thomas anderson',
    'denis villeneuve', 'coen brothers', 'david fincher', 'ridley scott',
    'francis ford coppola', 'steven spielberg', 'terrence malick',
    'sofia coppola', 'darren aronofsky', 'charlie kaufman', 'spike jonze',
    'orson welles', 'billy wilder', 'john ford', 'greta gerwig', 'ari aster', 
    'robert eggers', 'gaspar noé', 'nicolas winding refn', 'joel coen', 'ethan coen',
    'spike lee', 'woody allen', 'clint eastwood', 'michael mann', 'oliver stone',
    'james cameron', 'tim burton', 'sam raimi', 'john carpenter', 'george miller',
    
    // Additional Hollywood masters (reported missing by users)
    'brian de palma', 'richard linklater', 'sylvester stallone', 'william friedkin',
    'sidney lumet', 'kathryn bigelow', 'michael curtiz', 'howard hawks', 'ernst lubitsch',
    'frank capra', 'john huston', 'elia kazan', 'robert altman', 'mike nichols',
    'hal ashby', 'arthur penn', 'sam peckinpah', 'bob fosse', 'milos forman',
    'sydney pollack', 'peter bogdanovich', 'walter hill', 'john mctiernan',
    'tony scott', 'paul verhoeven', 'david lean', 'carol reed', 'powell and pressburger',
    'michael powell', 'emeric pressburger', 'barry levinson', 'ron howard',
    'rob reiner', 'ivan reitman', 'john landis', 'joe dante', 'robert zemeckis',
    'james wan', 'jordan peele', 'barry jenkins', 'damien chazelle', 'ryan coogler',
    'chloe zhao', 'sean baker', 'safdie brothers', 'josh safdie', 'benny safdie',
    'kelly reichardt', 'lynne ramsay', 'debra granik', 'andrea arnold',
    'todd haynes', 'todd phillips', 'adam mckay', 'david o. russell', 'james gray',
    'bennett miller', 'derek cianfrance', 'jeff nichols', 'david gordon green',
    
    // Japanese auteurs
    'akira kurosawa', 'hayao miyazaki', 'yasujirō ozu', 'kenji mizoguchi', 'isao takahata',
    'hirokazu kore-eda', 'takeshi kitano', 'satoshi kon', 'mamoru hosoda', 'makoto shinkai',
    'kiyoshi kurosawa', 'shinya tsukamoto', 'takashi miike', 'sion sono', 'masaki kobayashi',
    'seijun suzuki', 'nagisa oshima', 'shohei imamura', 'mikio naruse', 'kon ichikawa',
    'mamoru oshii', 'hideaki anno', 'naoko yamada', 'ryusuke hamaguchi',
    
    // Korean auteurs
    'bong joon-ho', 'park chan-wook', 'kim ki-duk', 'lee chang-dong', 'hong sang-soo',
    'kim jee-woon', 'na hong-jin', 'yeon sang-ho', 'im kwon-taek',
    
    // Chinese/Hong Kong/Taiwan auteurs
    'wong kar-wai', 'zhang yimou', 'chen kaige', 'ang lee', 'hou hsiao-hsien',
    'edward yang', 'tsai ming-liang', 'jia zhangke', 'john woo', 'johnnie to',
    'stephen chow', 'king hu', 'bi gan', 'lou ye',
    
    // Indian auteurs
    'satyajit ray', 'ritwik ghatak', 'guru dutt', 'raj kapoor', 'bimal roy',
    'mani ratnam', 'adoor gopalakrishnan', 'shyam benegal', 'mrinal sen',
    'anurag kashyap', 'vishal bhardwaj', 's.s. rajamouli', 'sanjay leela bhansali',
    'vetrimaaran', 'lokesh kanagaraj', 'pa. ranjith', 'lijo jose pellissery',
    'asghar farhadi', 'majid majidi', 'abbas kiarostami', 'jafar panahi', 'mohsen makhmalbaf',
    
    // European auteurs
    'ingmar bergman', 'andrei tarkovsky', 'federico fellini', 'lars von trier', 'michael haneke',
    'jean-luc godard', 'fritz lang', 'f.w. murnau', 'sergio leone', 'yorgos lanthimos',
    'françois truffaut', 'agnès varda', 'jean renoir', 'robert bresson', 'jacques tati',
    'jacques demy', 'jean-pierre melville', 'claude chabrol', 'eric rohmer', 'alain resnais',
    'louis malle', 'leos carax', 'claire denis', 'olivier assayas', 'arnaud desplechin',
    'jacques audiard', 'céline sciamma', 'julia ducournau', 'mathieu kassovitz',
    'jean-jacques beineix', 'luc besson', 'patrice leconte', 'bertrand tavernier',
    'krzysztof kieślowski', 'andrzej wajda', 'roman polanski', 'pawel pawlikowski',
    'agnieszka holland', 'jerzy skolimowski',
    'pedro almodóvar', 'luis buñuel', 'carlos saura', 'victor erice',
    'julio medem', 'alejandro amenábar', 'j.a. bayona', 'rodrigo sorogoyen',
    'rainer werner fassbinder', 'werner herzog', 'wim wenders', 'florian henckel von donnersmarck',
    'wolfgang petersen', 'tom tykwer', 'fatih akin', 'christian petzold', 'maren ade',
    'béla tarr', 'elem klimov', 'sergei eisenstein', 'dziga vertov', 'aleksei german',
    'andrei zvyagintsev', 'alexander sokurov', 'nikita mikhalkov', 'alexey balabanov',
    'pier paolo pasolini', 'luchino visconti', 'vittorio de sica', 'michelangelo antonioni',
    'roberto rossellini', 'bernardo bertolucci', 'ermanno olmi', 'marco bellocchio',
    'matteo garrone', 'luca guadagnino', 'sorrentino paolo', 'nanni moretti',
    'dario argento', 'mario bava', 'paolo sorrentino', 'lucio fulci', 'giallo',
    'carl theodor dreyer', 'thomas vinterberg', 'roy andersson', 'ruben östlund',
    'nicolas winding refn', 'susanne bier',
    'theo angelopoulos', 'nuri bilge ceylan', 'semih kaplanoğlu',
    'aki kaurismäki', 'mika kaurismäki',
    'michael winterbottom', 'danny boyle', 'edgar wright', 'guy ritchie', 'matthew vaughn',
    'ken loach', 'mike leigh', 'stephen frears', 'terence davies', 'peter greenaway',
    'nicolas roeg', 'alan parker', 'terry gilliam', 'ridley scott', 'tony scott',
    'christopher smith', 'ben wheatley', 'jonathan glazer', 'steve mcqueen',
    
    // Latin American auteurs
    'guillermo del toro', 'alfonso cuarón', 'alejandro gonzález iñárritu',
    'fernando meirelles', 'walter salles', 'glauber rocha', 'kleber mendonça filho',
    'lucrecia martel', 'pablo larraín', 'alejandro jodorowsky',
    
    // Other international auteurs
    'denis villeneuve', 'david cronenberg', 'xavier dolan', 'atom egoyan',
    'jane campion', 'peter weir', 'george miller', 'taika waititi',
    'apichatpong weerasethakul', 'pen-ek ratanaruang', 'lav diaz', 'brillante mendoza'
]);

// =====================================================
// FRANCHISE/BLOCKBUSTER DETECTION
// =====================================================
const FRANCHISE_KEYWORDS = [
    'marvel', 'avengers', 'spider-man', 'batman', 'superman', 'dc extended',
    'fast & furious', 'fast and furious', 'transformers', 'jurassic', 'star wars', 'harry potter',
    'lord of the rings', 'hobbit', 'pirates of the caribbean', 'mission impossible',
    'james bond', '007', 'x-men', 'fantastic four', 'teenage mutant ninja', 'minions'
];

// =====================================================
// CULT CLASSIC DETECTION THRESHOLDS
// =====================================================
const CULT_VOTE_THRESHOLD = {
    max: 500000,
    min: 50000
};

// =====================================================
// HELPER: Get Movie Details from TMDB with Extended Info
// =====================================================
async function getMovieDetails(tmdbId) {
    try {
        // Check memory cache first
        if (memoryCache.has(tmdbId)) {
            console.log(`[CACHE HIT] Found movie ${tmdbId} in memory cache`);
            return memoryCache.get(tmdbId);
        }

        // Check database cache
        let dbRes = await query('SELECT * FROM movies WHERE tmdb_id = $1', [tmdbId]);
        
        if (dbRes.rows.length > 0) {
            console.log(`[CACHE HIT] Found ${dbRes.rows[0].title} in database`);
            memoryCache.set(tmdbId, dbRes.rows[0]);
            return dbRes.rows[0];
        }

        // Fetch from TMDB with credits for director info
        const apiKey = process.env.TMDB_API_KEY;
        if (!apiKey || apiKey === 'your_tmdb_api_key_here') {
            console.log(`[TMDB] No API key configured, using fallback data`);
            return null;
        }

        const movieUrl = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${apiKey}&append_to_response=credits,keywords`;
        const response = await axios.get(movieUrl, { timeout: 10000 });
        const data = response.data;

        const genreNames = data.genres.map(g => g.name);
        const year = data.release_date ? parseInt(data.release_date.substring(0, 4)) : 0;
        
        // Extract director(s)
        const directors = data.credits?.crew
            ?.filter(c => c.job === 'Director')
            ?.map(c => c.name) || [];

        // Extract production countries
        const countries = data.production_countries?.map(c => c.iso_3166_1) || [];
        
        // Check if foreign language (non-English original)
        const isForeignLanguage = data.original_language !== 'en';
        
        // Check if black & white (approximation based on year and keywords)
        const isBlackAndWhite = year < 1960 || 
            data.keywords?.keywords?.some(k => k.name.toLowerCase().includes('black and white'));
        
        // Check if silent era
        const isSilentEra = year < 1930;

        // Calculate rarity score based on vote count and rating
        const rarityScore = calculateRarityScore(data.vote_count, data.vote_average, year);

        // Build movie object
        const movieData = {
            tmdb_id: data.id,
            title: data.title,
            release_year: year,
            rating: data.vote_average,
            genres: genreNames,
            vote_count: data.vote_count,
            directors: directors,
            countries: countries,
            is_foreign: isForeignLanguage,
            is_bw: isBlackAndWhite,
            is_silent: isSilentEra,
            rarity_score: rarityScore,
            poster_path: data.poster_path
        };

        // Store in memory cache
        memoryCache.set(tmdbId, movieData);

        // Try to store in database (non-blocking)
        try {
            const insertQuery = `
                INSERT INTO movies (
                    tmdb_id, title, release_year, rating, genres, vote_count,
                    directors, countries, is_foreign, is_bw, is_silent, rarity_score, poster_path
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                ON CONFLICT (tmdb_id) DO UPDATE SET
                    rating = EXCLUDED.rating,
                    vote_count = EXCLUDED.vote_count,
                    rarity_score = EXCLUDED.rarity_score
                RETURNING *`;
            
            await query(insertQuery, [
                data.id,
                data.title,
                year,
                data.vote_average,
                genreNames,
                data.vote_count,
                directors,
                countries,
                isForeignLanguage,
                isBlackAndWhite,
                isSilentEra,
                rarityScore,
                data.poster_path
            ]);
        } catch (dbError) {
            console.log(`[DB] Could not cache movie: ${dbError.message}`);
        }

        return movieData;
    } catch (error) {
        console.error(`Error fetching movie ${tmdbId}:`, error.message);
        return null;
    }
}

// =====================================================
// HELPER: Normalize title for comparison
// =====================================================
function normalizeTitle(title) {
    if (!title) return '';
    return title
        .toLowerCase()
        .replace(/[''`´]/g, "'")      // Normalize quotes
        .replace(/[""„]/g, '"')       // Normalize double quotes
        .replace(/[:\-–—,\.!?]/g, ' ')  // Replace punctuation with space
        .replace(/&/g, 'and')         // & to and
        .replace(/\s+/g, ' ')         // Multiple spaces to single
        .replace(/[^a-z0-9\s']/g, '') // Remove special chars
        .trim();
}

// =====================================================
// HELPER: Check if titles match (VERY STRICT comparison)
// "Linda Linda Linda" should NOT match "The Story of Linda"
// =====================================================
function titlesMatch(searchTitle, resultTitle) {
    if (!searchTitle || !resultTitle) return false;
    
    const normSearch = normalizeTitle(searchTitle);
    const normResult = normalizeTitle(resultTitle);
    
    // Exact match - BEST
    if (normSearch === normResult) return true;
    
    // Handle "The" prefix differences (e.g., "Godfather" vs "The Godfather")
    const searchNoThe = normSearch.replace(/^the /, '');
    const resultNoThe = normResult.replace(/^the /, '');
    if (searchNoThe === resultNoThe) return true;
    if (searchNoThe === normResult) return true;
    if (normSearch === resultNoThe) return true;
    
    // Handle "A" prefix differences
    const searchNoA = normSearch.replace(/^a /, '');
    const resultNoA = normResult.replace(/^a /, '');
    if (searchNoA === resultNoA) return true;
    
    // STRICT: Do NOT allow partial matches!
    // "Linda Linda Linda" should NOT match "The Story of Linda"
    // "Yojimbo" should NOT match "Zatoichi Meets Yojimbo"
    // "Cure" should NOT match "The Cure for Wellness"
    
    return false;
}

// =====================================================
// HELPER: Calculate title similarity (0-100)
// STRICT: Requires high word overlap, not just substring
// =====================================================
function calculateTitleSimilarity(title1, title2) {
    const norm1 = normalizeTitle(title1);
    const norm2 = normalizeTitle(title2);
    
    if (norm1 === norm2) return 100;
    if (!norm1 || !norm2) return 0;
    
    // Split into words (ignore very short words)
    const words1 = norm1.split(' ').filter(w => w.length > 1);
    const words2 = norm2.split(' ').filter(w => w.length > 1);
    
    if (words1.length === 0 || words2.length === 0) return 0;
    
    // Count EXACT word matches
    const matchingWords = words1.filter(w => words2.includes(w));
    
    // Calculate match ratio based on BOTH titles
    // "Linda Linda Linda" (3 words) vs "The Story of Linda" (4 words)
    // Matching: 1 word ("linda") - but "linda" appears 3 times in first title
    // This should be LOW similarity
    
    const uniqueWords1 = [...new Set(words1)];
    const uniqueWords2 = [...new Set(words2)];
    const uniqueMatches = uniqueWords1.filter(w => uniqueWords2.includes(w));
    
    // Need high overlap in BOTH directions
    const ratio1 = uniqueMatches.length / uniqueWords1.length; // How much of title1 is in title2
    const ratio2 = uniqueMatches.length / uniqueWords2.length; // How much of title2 is in title1
    
    // Use the MINIMUM ratio (stricter matching)
    const minRatio = Math.min(ratio1, ratio2);
    
    // If one title is much longer than the other, penalize
    const lengthRatio = Math.min(norm1.length, norm2.length) / Math.max(norm1.length, norm2.length);
    
    // Final similarity requires BOTH good word overlap AND similar length
    const similarity = Math.round(minRatio * lengthRatio * 100);
    
    return similarity;
}

// =====================================================
// HELPER: Search TMDB - EXACT TITLE + YEAR matching
// THIS IS CRITICAL - YEAR FROM LETTERBOXD IS ALWAYS CORRECT!
// =====================================================
async function searchMovieByTitle(title, year = null) {
    try {
        const apiKey = process.env.TMDB_API_KEY;
        if (!apiKey || apiKey === 'your_tmdb_api_key_here') {
            console.log(`[TMDB] No API key - cannot search for "${title}"`);
            return null;
        }

        const cleanTitle = title.replace(/['']/g, "'").trim();
        console.log(`[TMDB] ========================================`);
        console.log(`[TMDB] Searching: "${cleanTitle}" | REQUIRED YEAR: ${year || 'unknown'}`);
        
        // Collect all results from multiple search strategies
        let allResults = [];
        
        // STRATEGY 1: Basic search
        const url1 = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(cleanTitle)}&language=en-US&include_adult=false`;
        const response1 = await axios.get(url1, { timeout: 10000 });
        allResults = allResults.concat(response1.data.results || []);
        
        // STRATEGY 2: If year provided, search with year in query (helps for same-title films)
        if (year && year > 1800) {
            const url2 = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(cleanTitle)}&year=${year}&language=en-US`;
            try {
                const response2 = await axios.get(url2, { timeout: 10000 });
                allResults = allResults.concat(response2.data.results || []);
            } catch (e) {}
            
            // STRATEGY 3: Use primary_release_year (more accurate for some films)
            const url3 = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(cleanTitle)}&primary_release_year=${year}&language=en-US`;
            try {
                const response3 = await axios.get(url3, { timeout: 10000 });
                allResults = allResults.concat(response3.data.results || []);
            } catch (e) {}
        }
        
        // STRATEGY 4: Search in original language (for foreign films)
        // Japanese, Korean, French, etc. films often have different English titles
        const url4 = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(cleanTitle)}&language=ja-JP`;
        try {
            const response4 = await axios.get(url4, { timeout: 10000 });
            allResults = allResults.concat(response4.data.results || []);
        } catch (e) {}
        
        // De-duplicate results by ID
        const seenIds = new Set();
        const results = allResults.filter(m => {
            if (seenIds.has(m.id)) return false;
            seenIds.add(m.id);
            return true;
        });
        
        if (results.length === 0) {
            console.log(`[TMDB] No results found for "${cleanTitle}"`);
            return null;
        }
        
        console.log(`[TMDB] Found ${results.length} unique results (from ${allResults.length} total)`);
        
        // Log results for debugging
        results.slice(0, 10).forEach((m, i) => {
            const y = m.release_date ? m.release_date.substring(0, 4) : 'N/A';
            console.log(`[TMDB]   ${i+1}. "${m.title}" (${y}) [original: "${m.original_title}"]`);
        });
        
        // =====================================================
        // MATCHING PRIORITY - YEAR IS KING!
        // Letterboxd year is ALWAYS correct, we MUST respect it
        // =====================================================
        
        if (year && year > 1800) {
            
            // PRIORITY 1: EXACT year + EXACT title (PERFECT MATCH)
            for (const movie of results) {
                const movieYear = movie.release_date ? parseInt(movie.release_date.substring(0, 4)) : 0;
                if (movieYear === year) {
                    const exactTitle = titlesMatch(cleanTitle, movie.title) || titlesMatch(cleanTitle, movie.original_title);
                    if (exactTitle) {
                        console.log(`[TMDB] ✅ PERFECT MATCH: "${movie.title}" (${movieYear})`);
                        return movie.id;
                    }
                }
            }
            
            // PRIORITY 2: EXACT year + similar title (translations, punctuation differences)
            for (const movie of results) {
                const movieYear = movie.release_date ? parseInt(movie.release_date.substring(0, 4)) : 0;
                if (movieYear === year) {
                    const sim1 = calculateTitleSimilarity(cleanTitle, movie.title);
                    const sim2 = calculateTitleSimilarity(cleanTitle, movie.original_title);
                    if (sim1 >= 50 || sim2 >= 50) {
                        console.log(`[TMDB] ✅ YEAR MATCH + SIMILAR TITLE: "${movie.title}" (${movieYear}) [sim: ${Math.max(sim1,sim2)}%]`);
                        return movie.id;
                    }
                }
            }
            
            // PRIORITY 3: EXACT year (even if title doesn't match - trust the year!)
            // This handles cases where TMDB has a different English title
            for (const movie of results) {
                const movieYear = movie.release_date ? parseInt(movie.release_date.substring(0, 4)) : 0;
                if (movieYear === year) {
                    console.log(`[TMDB] ✅ EXACT YEAR: "${movie.title}" (${movieYear}) - trusting Letterboxd year!`);
                    return movie.id;
                }
            }
            
            // PRIORITY 4: Year ±1 + exact title (regional release date differences)
            for (const movie of results) {
                const movieYear = movie.release_date ? parseInt(movie.release_date.substring(0, 4)) : 0;
                if (Math.abs(movieYear - year) === 1) {
                    const exactTitle = titlesMatch(cleanTitle, movie.title) || titlesMatch(cleanTitle, movie.original_title);
                    if (exactTitle) {
                        console.log(`[TMDB] ✅ CLOSE YEAR (±1): "${movie.title}" (${movieYear})`);
                        return movie.id;
                    }
                }
            }
            
            // =====================================================
            // NO MATCH FOUND WITH CORRECT YEAR!
            // DO NOT return a wrong-year movie. Better to return null.
            // =====================================================
            console.log(`[TMDB] ❌ NO MATCH for "${cleanTitle}" (${year})`);
            
            // Log what we would have matched (for debugging)
            const titleMatches = results.filter(m => 
                titlesMatch(cleanTitle, m.title) || titlesMatch(cleanTitle, m.original_title)
            );
            if (titleMatches.length > 0) {
                const wrongYear = titleMatches[0];
                const wrongYearNum = wrongYear.release_date ? parseInt(wrongYear.release_date.substring(0, 4)) : 0;
                console.log(`[TMDB] ❌ REJECTED: "${wrongYear.title}" (${wrongYearNum}) - wanted ${year}, got ${wrongYearNum}`);
            }
            
            return null; // DO NOT RETURN WRONG MOVIE!
        }
        
        // No year provided - match by title only (risky, but unavoidable)
        for (const movie of results) {
            const exactTitle = titlesMatch(cleanTitle, movie.title) || titlesMatch(cleanTitle, movie.original_title);
            if (exactTitle) {
                const movieYear = movie.release_date ? parseInt(movie.release_date.substring(0, 4)) : 0;
                console.log(`[TMDB] ⚠️ Title match (no year): "${movie.title}" (${movieYear})`);
                return movie.id;
            }
        }
        
        console.log(`[TMDB] ❌ No match for "${cleanTitle}"`);
        return null;
        
    } catch (error) {
        console.error(`[TMDB] Error searching for "${title}":`, error.message);
        return null;
    }
}

// =====================================================
// RARITY SCORE CALCULATION - Balanced contribution
// =====================================================
function calculateRarityScore(voteCount, rating, year) {
    let score = 0;
    
    // Vote count (max 30 points) - primary obscurity factor
    if (voteCount > 2000000) score += 0;
    else if (voteCount > 1000000) score += 5;
    else if (voteCount > 500000) score += 10;
    else if (voteCount > 200000) score += 15;
    else if (voteCount > 100000) score += 18;
    else if (voteCount > 50000) score += 22;
    else if (voteCount > 20000) score += 26;
    else score += 30;
    
    // Year bonus (max 10 points) - modest bonus for older films
    const currentYear = new Date().getFullYear();
    const age = currentYear - year;
    if (age >= 80) score += 10;
    else if (age >= 60) score += 7;
    else if (age >= 40) score += 5;
    else if (age >= 25) score += 3;
    else if (age >= 15) score += 1;
    
    // Hidden gem bonus (max 10 points)
    if (rating >= 8.0 && voteCount < 50000) score += 10;
    else if (rating >= 7.5 && voteCount < 100000) score += 5;
    
    return Math.min(50, score);
}

// =====================================================
// MAIN RANKING ALGORITHM - 10 LEVEL SYSTEM
// =====================================================
function calculateRank(movies) {
    const validMovies = movies.filter(m => m != null);
    
    if (validMovies.length === 0) {
        return {
            level: 1,
            tierName: TIERS[1].name,
            tierIcon: TIERS[1].icon,
            tierDescription: TIERS[1].description,
            tierColor: TIERS[1].color,
            score: 0,
            avgRating: "0.0",
            analysis: {},
            reasons: ["No valid movies found"]
        };
    }

    const analysis = {
        avgRating: 0,
        totalRarityScore: 0,
        genreCount: 0,
        uniqueGenres: new Set(),
        yearSpread: 0,
        oldestYear: 9999,
        newestYear: 0,
        hasPreWar: false,
        hasSilentEra: false,
        hasBlackWhite: false,
        hasForeign: false,
        hasModernClassic: false,
        auteurCount: 0,
        isCultHeavy: false,
        directorDiversity: new Set(),
        franchiseCount: 0
    };

    // Analyze each movie
    validMovies.forEach(movie => {
        // Basic stats
        analysis.avgRating += parseFloat(movie.rating) || 0;
        analysis.totalRarityScore += movie.rarity_score || 0;
        
        // Year analysis
        const year = movie.release_year || 2000;
        analysis.oldestYear = Math.min(analysis.oldestYear, year);
        analysis.newestYear = Math.max(analysis.newestYear, year);
        
        if (year < 1970) analysis.hasPreWar = true;
        if (year < 1930) analysis.hasSilentEra = true;
        if (movie.is_bw) analysis.hasBlackWhite = true;
        if (movie.is_foreign) analysis.hasForeign = true;
        if (year >= 2000 && parseFloat(movie.rating) >= 8.0) analysis.hasModernClassic = true;

        // Genre diversity
        const genres = Array.isArray(movie.genres) ? movie.genres : [];
        genres.forEach(g => analysis.uniqueGenres.add(g));

        // Director analysis
        const directors = Array.isArray(movie.directors) ? movie.directors : [];
        directors.forEach(d => {
            analysis.directorDiversity.add(d.toLowerCase());
            if (AUTEUR_DIRECTORS.has(d.toLowerCase())) {
                analysis.auteurCount++;
            }
        });

        // Franchise detection
        const titleLower = movie.title.toLowerCase();
        if (FRANCHISE_KEYWORDS.some(f => titleLower.includes(f))) {
            analysis.franchiseCount++;
        }

        // Cult classic detection
        if (movie.vote_count < CULT_VOTE_THRESHOLD.max && 
            movie.vote_count > CULT_VOTE_THRESHOLD.min && 
            parseFloat(movie.rating) >= 7.5) {
            analysis.isCultHeavy = true;
        }
    });

    // Final calculations
    analysis.avgRating = analysis.avgRating / validMovies.length;
    analysis.genreCount = analysis.uniqueGenres.size;
    analysis.yearSpread = analysis.newestYear - analysis.oldestYear;

    // =====================================================
    // BALANCED SCORING SYSTEM - Equal weight distribution
    // Total possible: 100 points, evenly spread across factors
    // IMPORTANT: Round each score BEFORE adding to prevent mismatch
    // =====================================================
    let score = 0;
    let reasons = [];
    let scoreBreakdown = {}; // Track individual scores

    // ----- 1. RATING QUALITY (Max 20 points) -----
    // Linear scale from 5.0 to 9.0 rating
    const ratingScoreRaw = Math.min(20, Math.max(0, (analysis.avgRating - 5) * 5));
    const ratingScore = Math.round(ratingScoreRaw);
    score += ratingScore;
    scoreBreakdown.rating = ratingScore;
    if (analysis.avgRating >= 8.0) {
        reasons.push(`Excellent taste: ${analysis.avgRating.toFixed(1)} avg rating`);
    } else if (analysis.avgRating >= 7.0) {
        reasons.push(`Solid picks: ${analysis.avgRating.toFixed(1)} avg rating`);
    } else {
        reasons.push(`Average rating: ${analysis.avgRating.toFixed(1)}`);
    }

    // ----- 2. GENRE DIVERSITY (Max 20 points) -----
    // 4 movies can have ~8-12 genres combined, scale accordingly
    const genreScoreRaw = Math.min(20, analysis.genreCount * 2.5);
    const genreScore = Math.round(genreScoreRaw);
    score += genreScore;
    scoreBreakdown.genre = genreScore;
    if (analysis.genreCount >= 7) {
        reasons.push(`Diverse palette: ${analysis.genreCount} genres explored`);
    } else if (analysis.genreCount >= 5) {
        reasons.push(`Good variety: ${analysis.genreCount} genres`);
    }

    // ----- 3. OBSCURITY/RARITY (Max 20 points) -----
    // avgRarity is 0-50, scale to 0-20
    const avgRarity = analysis.totalRarityScore / validMovies.length;
    const rarityScoreRaw = Math.min(20, avgRarity * 0.4);
    const rarityScore = Math.round(rarityScoreRaw);
    score += rarityScore;
    scoreBreakdown.rarity = rarityScore;
    if (avgRarity >= 35) {
        reasons.push("Includes lesser-known gems");
    } else if (avgRarity >= 20) {
        reasons.push("Mix of popular and lesser-known films");
    }

    // ----- 4. ERA SPREAD (Max 20 points) -----
    // Year spread of 0-80+ years, scale to 0-20
    const eraScoreRaw = Math.min(20, analysis.yearSpread * 0.25);
    const eraScore = Math.round(eraScoreRaw);
    score += eraScore;
    scoreBreakdown.era = eraScore;
    if (analysis.yearSpread >= 50) {
        reasons.push(`Wide era range: ${analysis.yearSpread} years of cinema`);
    } else if (analysis.yearSpread >= 25) {
        reasons.push(`Good era range: ${analysis.yearSpread} year spread`);
    }

    // ----- 5. CINEPHILE TRAITS (Max 20 points) -----
    let traitScore = 0;
    
    // Foreign films (5 pts)
    if (analysis.hasForeign) {
        traitScore += 5;
        reasons.push("International cinema represented 🌍");
    }
    
    // Classic cinema pre-1970 (5 pts)
    if (analysis.hasPreWar) {
        traitScore += 5;
        reasons.push("Classic cinema included 🎞️");
    }
    
    // Famous directors (5 pts max)
    const auteurScore = Math.min(5, analysis.auteurCount * 1.5);
    traitScore += auteurScore;
    if (analysis.auteurCount >= 2) {
        reasons.push(`Great directors: ${analysis.auteurCount} renowned filmmakers`);
    } else if (analysis.auteurCount === 1) {
        reasons.push(`Features a renowned director`);
    }
    
    // Modern classics post-2000 with high rating (5 pts)
    if (analysis.hasModernClassic) {
        traitScore += 5;
        reasons.push("Eye for modern masterpieces");
    }
    
    const finalTraitScore = Math.min(20, traitScore);
    score += finalTraitScore;
    scoreBreakdown.traits = Math.round(finalTraitScore);

    // ----- PENALTIES (reduce score) -----
    let penalty = 0;
    if (analysis.franchiseCount >= 3) {
        penalty = 12;
        score -= penalty;
        reasons.push("Multiple franchise films detected");
    } else if (analysis.franchiseCount >= 2) {
        penalty = 6;
        score -= penalty;
    }
    scoreBreakdown.penalty = penalty;

    // Calculate total before clamping
    const rawTotal = scoreBreakdown.rating + scoreBreakdown.genre + scoreBreakdown.rarity + 
                     scoreBreakdown.era + scoreBreakdown.traits - scoreBreakdown.penalty;
    scoreBreakdown.rawTotal = rawTotal;

    // Ensure score stays in 0-100 range
    score = Math.max(0, Math.min(100, Math.round(score)));
    scoreBreakdown.finalScore = score;

    // Log the breakdown for debugging
    console.log(`[SCORE] Breakdown: Rating=${scoreBreakdown.rating} + Genre=${scoreBreakdown.genre} + Rarity=${scoreBreakdown.rarity} + Era=${scoreBreakdown.era} + Traits=${scoreBreakdown.traits} - Penalty=${scoreBreakdown.penalty} = ${score}`);

    // =====================================================
    // LEVEL DETERMINATION - Pure score-based, equal intervals
    // Each level covers ~10 points for equal distribution
    // =====================================================
    let level;
    
    if (score >= 90) {
        level = 10;  // 90-100: Cinema Deity
    } else if (score >= 80) {
        level = 9;   // 80-89: Experimental Visionary
    } else if (score >= 70) {
        level = 8;   // 70-79: Criterion Collector
    } else if (score >= 60) {
        level = 7;   // 60-69: Film Historian
    } else if (score >= 50) {
        level = 6;   // 50-59: Auteur Devotee
    } else if (score >= 42) {
        level = 5;   // 42-49: Cult Classic Hunter
    } else if (score >= 34) {
        level = 4;   // 34-41: Genre Surfer
    } else if (score >= 26) {
        level = 3;   // 26-33: Modern Fan
    } else if (score >= 15) {
        level = 2;   // 15-25: Blockbuster Buff
    } else {
        level = 1;   // 0-14: Casual Viewer
    }

    const tierInfo = TIERS[level];
    
    // Convert TMDB 10-point scale to Letterboxd 5-star scale
    const letterboxdRating = (analysis.avgRating / 2).toFixed(1);
    
    // Calculate average year gap between films (more meaningful than total span)
    let avgYearGap = 0;
    if (validMovies.length > 1) {
        const years = validMovies.map(m => m.release_year || 2000).sort((a, b) => a - b);
        let totalGap = 0;
        for (let i = 1; i < years.length; i++) {
            totalGap += years[i] - years[i - 1];
        }
        avgYearGap = Math.round(totalGap / (years.length - 1));
    }
    
    return {
        level,
        tierName: tierInfo.name,
        tierIcon: tierInfo.icon,
        tierDescription: tierInfo.description,
        tierColor: tierInfo.color,
        score: score,
        avgRating: letterboxdRating,
        scoreBreakdown: scoreBreakdown,  // Include breakdown for frontend
        analysis: {
            genreCount: analysis.genreCount,
            yearSpread: analysis.yearSpread,
            avgYearGap: avgYearGap,
            oldestFilm: analysis.oldestYear,
            newestFilm: analysis.newestYear,
            avgRarity: Math.round(avgRarity),
            auteurCount: analysis.auteurCount,
            hasForeign: analysis.hasForeign,
            hasClassic: analysis.hasPreWar,
            hasSilentOrBW: analysis.hasSilentEra || analysis.hasBlackWhite,
            franchiseCount: analysis.franchiseCount
        },
        reasons
    };
}

module.exports = { getMovieDetails, searchMovieByTitle, calculateRank, calculateRarityScore, TIERS };
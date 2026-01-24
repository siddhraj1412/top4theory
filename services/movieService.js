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
    'stanley kubrick', 'alfred hitchcock', 'martin scorsese', 'quentin tarantino',
    'christopher nolan', 'david lynch', 'wes anderson', 'paul thomas anderson',
    'denis villeneuve', 'coen brothers', 'david fincher', 'ridley scott',
    'francis ford coppola', 'steven spielberg', 'akira kurosawa', 'ingmar bergman',
    'andrei tarkovsky', 'federico fellini', 'wong kar-wai', 'terrence malick',
    'sofia coppola', 'darren aronofsky', 'guillermo del toro', 'bong joon-ho',
    'park chan-wook', 'hayao miyazaki', 'charlie kaufman', 'spike jonze',
    'alfonso cuarón', 'alejandro gonzález iñárritu', 'lars von trier', 'michael haneke',
    'jean-luc godard', 'orson welles', 'billy wilder', 'fritz lang', 'f.w. murnau',
    'john ford', 'sergio leone', 'greta gerwig', 'ari aster', 'robert eggers',
    'yorgos lanthimos', 'gaspar noé', 'nicolas winding refn', 'joel coen', 'ethan coen'
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
// HELPER: Search TMDB by movie title
// =====================================================
async function searchMovieByTitle(title, year = null) {
    try {
        const apiKey = process.env.TMDB_API_KEY;
        if (!apiKey || apiKey === 'your_tmdb_api_key_here') {
            console.log(`[TMDB] No API key - cannot search for "${title}"`);
            return null;
        }

        let url = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(title)}`;
        if (year) {
            url += `&year=${year}`;
        }
        
        const response = await axios.get(url, { timeout: 10000 });
        if (response.data.results && response.data.results.length > 0) {
            return response.data.results[0].id;
        }
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
    // =====================================================
    let score = 0;
    let reasons = [];

    // ----- 1. RATING QUALITY (Max 20 points) -----
    // Linear scale from 5.0 to 9.0 rating
    const ratingScore = Math.min(20, Math.max(0, (analysis.avgRating - 5) * 5));
    score += ratingScore;
    if (analysis.avgRating >= 8.0) {
        reasons.push(`Excellent taste: ${analysis.avgRating.toFixed(1)} avg rating`);
    } else if (analysis.avgRating >= 7.0) {
        reasons.push(`Solid picks: ${analysis.avgRating.toFixed(1)} avg rating`);
    } else {
        reasons.push(`Average rating: ${analysis.avgRating.toFixed(1)}`);
    }

    // ----- 2. GENRE DIVERSITY (Max 20 points) -----
    // 4 movies can have ~8-12 genres combined, scale accordingly
    const genreScore = Math.min(20, analysis.genreCount * 2.5);
    score += genreScore;
    if (analysis.genreCount >= 7) {
        reasons.push(`Diverse palette: ${analysis.genreCount} genres explored`);
    } else if (analysis.genreCount >= 5) {
        reasons.push(`Good variety: ${analysis.genreCount} genres`);
    }

    // ----- 3. OBSCURITY/RARITY (Max 20 points) -----
    // avgRarity is 0-50, scale to 0-20
    const avgRarity = analysis.totalRarityScore / validMovies.length;
    const rarityScore = Math.min(20, avgRarity * 0.4);
    score += rarityScore;
    if (avgRarity >= 35) {
        reasons.push("Deep cuts - you dig beyond the surface");
    } else if (avgRarity >= 20) {
        reasons.push("Nice mix of popular and lesser-known films");
    }

    // ----- 4. ERA SPREAD (Max 20 points) -----
    // Year spread of 0-80+ years, scale to 0-20
    const eraScore = Math.min(20, analysis.yearSpread * 0.25);
    score += eraScore;
    if (analysis.yearSpread >= 50) {
        reasons.push(`Time traveler: spans ${analysis.yearSpread} years of cinema`);
    } else if (analysis.yearSpread >= 25) {
        reasons.push(`Decent range: ${analysis.yearSpread} year spread`);
    }

    // ----- 5. CINEPHILE TRAITS (Max 20 points) -----
    let traitScore = 0;
    
    // Foreign films (5 pts)
    if (analysis.hasForeign) {
        traitScore += 5;
        reasons.push("Subtitles don't scare you");
    }
    
    // Classic cinema pre-1970 (5 pts)
    if (analysis.hasPreWar) {
        traitScore += 5;
        reasons.push("Respects the classics");
    }
    
    // Auteur directors (5 pts max)
    const auteurScore = Math.min(5, analysis.auteurCount * 1.5);
    traitScore += auteurScore;
    if (analysis.auteurCount >= 2) {
        reasons.push(`Auteur appreciation: ${analysis.auteurCount} master directors`);
    }
    
    // Modern classics post-2000 with high rating (5 pts)
    if (analysis.hasModernClassic) {
        traitScore += 5;
        reasons.push("Eye for modern masterpieces");
    }
    
    score += Math.min(20, traitScore);

    // ----- PENALTIES (reduce score) -----
    if (analysis.franchiseCount >= 3) {
        score -= 12;
        reasons.push("Franchise heavy - branch out!");
    } else if (analysis.franchiseCount >= 2) {
        score -= 6;
    }

    // Ensure score stays in 0-100 range
    score = Math.max(0, Math.min(100, score));

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
    
    return {
        level,
        tierName: tierInfo.name,
        tierIcon: tierInfo.icon,
        tierDescription: tierInfo.description,
        tierColor: tierInfo.color,
        score: Math.round(score),
        avgRating: letterboxdRating,
        analysis: {
            genreCount: analysis.genreCount,
            yearSpread: analysis.yearSpread,
            oldestFilm: analysis.oldestYear,
            newestFilm: analysis.newestYear,
            avgRarity: Math.round(avgRarity),
            auteurCount: analysis.auteurCount,
            hasForeign: analysis.hasForeign,
            hasClassic: analysis.hasPreWar,
            hasSilentOrBW: analysis.hasSilentEra || analysis.hasBlackWhite
        },
        reasons
    };
}

module.exports = { getMovieDetails, searchMovieByTitle, calculateRank, calculateRarityScore, TIERS };
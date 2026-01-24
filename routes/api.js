const express = require('express');
const router = express.Router();
const { getMovieDetails, searchMovieByTitle, calculateRank, TIERS } = require('../services/movieService');
const { scrapeUserTop4, scrapeUserProfile, scrapeMovieDetails } = require('../services/letterboxdScraper');

// =====================================================
// GET /api/rank/:username - Main endpoint to rank a user
// =====================================================
router.get('/rank/:username', async (req, res) => {
    try {
        const { username } = req.params;
        console.log(`\n========== Analyzing user: ${username} ==========`);

        // Step 1: Scrape user's Top 4 and profile stats from Letterboxd
        let top4Films = [];
        let profileStats = null;
        let usedDemoMode = false;
        
        try {
            const scrapeResult = await scrapeUserTop4(username);
            
            // Handle both old format (array) and new format (object with movies and profileStats)
            if (Array.isArray(scrapeResult)) {
                top4Films = scrapeResult;
            } else {
                top4Films = scrapeResult.movies || [];
                profileStats = scrapeResult.profileStats || null;
            }
            
            console.log(`[API] Scraped ${top4Films.length} favorite films for ${username}`);
            if (profileStats) {
                console.log(`[API] Profile stats: ${profileStats.filmsWatched} films watched`);
            }
            
            if (top4Films.length > 0) {
                top4Films.forEach((f, i) => console.log(`  ${i+1}. ${f.title} (${f.slug})`));
            }
        } catch (scrapeError) {
            console.log(`[API] Scrape failed: ${scrapeError.message}`);
            console.log(`[API] Falling back to demo mode for ${username}`);
            usedDemoMode = true;
            top4Films = generateDemoTop4(username);
        }

        if (top4Films.length === 0) {
            return res.status(404).json({ 
                error: "No favorite films found", 
                message: `User "${username}" either doesn't exist or hasn't set their Top 4 favorites on Letterboxd. Make sure the profile is public and has favorite films set.`
            });
        }

        // Step 2: Get detailed movie data from TMDB for each film
        // AND fetch official Letterboxd ratings
        console.log(`[API] Fetching movie data for ${top4Films.length} movies...`);
        
        const moviePromises = top4Films.map(async (film) => {
            try {
                // First, fetch official Letterboxd data (includes correct year!)
                let letterboxdData = null;
                if (film.slug) {
                    try {
                        letterboxdData = await scrapeMovieDetails(film.slug);
                        console.log(`[API] Letterboxd data for "${film.slug}": ${letterboxdData?.title} (${letterboxdData?.year})`);
                    } catch (lbErr) {
                        console.log(`[API] Could not fetch Letterboxd data for ${film.slug}`);
                    }
                }
                
                // Use Letterboxd year as the PRIMARY source (most accurate)
                // Fallback to slug year or film year
                const yearMatch = film.slug?.match(/-(\d{4})$/);
                const correctYear = letterboxdData?.year || (yearMatch ? parseInt(yearMatch[1]) : null) || film.year;
                const correctTitle = letterboxdData?.title || film.title;
                
                console.log(`[API] Searching TMDB for: "${correctTitle}" (${correctYear})`);
                
                // Search TMDB with the correct year from Letterboxd
                const tmdbId = await searchMovieByTitle(correctTitle, correctYear);
                
                if (tmdbId) {
                    console.log(`[API] Found TMDB ID ${tmdbId} for "${correctTitle}"`);
                    const movieData = await getMovieDetails(tmdbId);
                    if (movieData) {
                        // Verify the year matches (sanity check)
                        if (correctYear && movieData.release_year && Math.abs(movieData.release_year - correctYear) > 3) {
                            console.log(`[API] WARNING: Year mismatch for "${correctTitle}"! Letterboxd: ${correctYear}, TMDB: ${movieData.release_year}`);
                        }
                        
                        // Merge Letterboxd rating with TMDB data
                        return {
                            ...movieData,
                            // Override with Letterboxd data if TMDB year seems wrong
                            release_year: correctYear || movieData.release_year,
                            letterboxd_rating: letterboxdData?.letterboxdRating || null,
                            letterboxd_url: film.letterboxdUrl || letterboxdData?.letterboxdUrl
                        };
                    }
                }
                
                // Fallback: return basic info with Letterboxd data if available
                console.log(`[API] Using fallback data for "${correctTitle}"`);
                return {
                    title: correctTitle,
                    release_year: correctYear || 2000,
                    rating: 7.0,
                    letterboxd_rating: letterboxdData?.letterboxdRating || null,
                    genres: letterboxdData?.genres || [],
                    vote_count: 100000,
                    directors: letterboxdData?.directors || [],
                    is_foreign: false,
                    is_bw: false,
                    is_silent: false,
                    rarity_score: 15,
                    poster_path: null,
                    letterboxd_url: film.letterboxdUrl || letterboxdData?.letterboxdUrl
                };
            } catch (err) {
                console.log(`[API] Error fetching "${film.title}": ${err.message}`);
                return {
                    title: film.title,
                    release_year: 2000,
                    rating: 7.0,
                    letterboxd_rating: null,
                    genres: [],
                    vote_count: 100000,
                    directors: [],
                    is_foreign: false,
                    is_bw: false,
                    is_silent: false,
                    rarity_score: 15,
                    poster_path: null,
                    letterboxd_url: film.letterboxdUrl
                };
            }
        });

        const userMovies = await Promise.all(moviePromises);
        const validMovies = userMovies.filter(m => m !== null);

        console.log(`[API] Successfully processed ${validMovies.length} movies`);

        // Step 3: Calculate the rank
        const rankData = calculateRank(validMovies);

        // Step 4: Build response
        const response = {
            username: username,
            usedDemoMode: usedDemoMode,
            profileStats: profileStats ? {
                displayName: profileStats.displayName || username,
                filmsWatched: profileStats.filmsWatched || 0,
                filmsThisYear: profileStats.filmsThisYear || 0,
                following: profileStats.following || 0,
                followers: profileStats.followers || 0,
                lists: profileStats.lists || 0,
                reviews: profileStats.reviews || 0,
                bio: profileStats.bio || '',
                // Full profile stats from stats page
                topGenres: profileStats.topGenres || [],
                topDecades: profileStats.topDecades || [],
                topCountries: profileStats.topCountries || [],
                hoursWatched: profileStats.hoursWatched || 0,
                avgRating: profileStats.avgRating || 0,
                mostWatchedDirectors: profileStats.mostWatchedDirectors || []
            } : null,
            movies: validMovies.map(m => ({
                title: m.title,
                release_year: m.release_year,
                rating: parseFloat(m.rating).toFixed(1),
                letterboxd_rating: m.letterboxd_rating ? parseFloat(m.letterboxd_rating).toFixed(1) : null,
                letterboxd_url: m.letterboxd_url || null,
                genres: m.genres || [],
                directors: m.directors || [],
                poster_path: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
                rarity_score: m.rarity_score || 0,
                is_foreign: m.is_foreign || false,
                is_bw: m.is_bw || false
            })),
            level: rankData.level,
            tierName: rankData.tierName,
            tierIcon: rankData.tierIcon,
            tierDescription: rankData.tierDescription,
            tierColor: rankData.tierColor,
            score: rankData.score,
            avgRating: rankData.avgRating,
            scoreBreakdown: rankData.scoreBreakdown,  // Include score breakdown
            analysis: rankData.analysis,
            reasons: rankData.reasons
        };

        console.log(`[API] Result: Level ${rankData.level} - ${rankData.tierName} (Score: ${rankData.score})`);
        if (rankData.scoreBreakdown) {
            console.log(`[API] Breakdown: Rating=${rankData.scoreBreakdown.rating} + Genre=${rankData.scoreBreakdown.genre} + Rarity=${rankData.scoreBreakdown.rarity} + Era=${rankData.scoreBreakdown.era} + Traits=${rankData.scoreBreakdown.traits} - Penalty=${rankData.scoreBreakdown.penalty}`);
        }
        res.json(response);

    } catch (error) {
        console.error('[API ERROR]', error);
        res.status(500).json({ 
            error: "Server Error", 
            message: error.message 
        });
    }
});

// =====================================================
// GET /api/tiers - Get all tier information
// =====================================================
router.get('/tiers', (req, res) => {
    res.json(TIERS);
});

// =====================================================
// GET /api/test-scrape/:username - Test scraping endpoint
// =====================================================
router.get('/test-scrape/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const top4Films = await scrapeUserTop4(username);
        res.json({
            username,
            count: top4Films.length,
            films: top4Films
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// DEMO MODE: Generate Top 4 based on username hash
// =====================================================
function generateDemoTop4(username) {
    const demoMovies = [
        // Casual Viewer
        { title: "The Avengers", slug: "the-avengers-2012", year: 2012 },
        { title: "Fast & Furious 7", slug: "furious-7", year: 2015 },
        { title: "Transformers", slug: "transformers", year: 2007 },
        { title: "Minions", slug: "minions", year: 2015 },
        
        // Blockbuster Buff
        { title: "The Dark Knight", slug: "the-dark-knight", year: 2008 },
        { title: "Inception", slug: "inception", year: 2010 },
        { title: "Avatar", slug: "avatar", year: 2009 },
        { title: "Interstellar", slug: "interstellar", year: 2014 },
        
        // Modern Fan
        { title: "La La Land", slug: "la-la-land", year: 2016 },
        { title: "Get Out", slug: "get-out-2017", year: 2017 },
        { title: "Parasite", slug: "parasite-2019", year: 2019 },
        { title: "Everything Everywhere All at Once", slug: "everything-everywhere-all-at-once", year: 2022 },
        
        // Cult Classics
        { title: "Fight Club", slug: "fight-club", year: 1999 },
        { title: "The Big Lebowski", slug: "the-big-lebowski", year: 1998 },
        { title: "Blade Runner", slug: "blade-runner", year: 1982 },
        { title: "Pulp Fiction", slug: "pulp-fiction", year: 1994 },
        
        // Auteur Films
        { title: "2001: A Space Odyssey", slug: "2001-a-space-odyssey", year: 1968 },
        { title: "Mulholland Drive", slug: "mulholland-drive", year: 2001 },
        { title: "The Grand Budapest Hotel", slug: "the-grand-budapest-hotel", year: 2014 },
        { title: "There Will Be Blood", slug: "there-will-be-blood", year: 2007 },
        
        // Film Historian Classics
        { title: "Citizen Kane", slug: "citizen-kane", year: 1941 },
        { title: "Casablanca", slug: "casablanca", year: 1942 },
        { title: "Seven Samurai", slug: "seven-samurai", year: 1954 },
        { title: "Vertigo", slug: "vertigo", year: 1958 },
        
        // Foreign Masterpieces
        { title: "In the Mood for Love", slug: "in-the-mood-for-love", year: 2000 },
        { title: "Spirited Away", slug: "spirited-away", year: 2001 },
        { title: "Amélie", slug: "amelie", year: 2001 },
        { title: "City of God", slug: "city-of-god", year: 2002 },
        
        // Silent Era / B&W
        { title: "Metropolis", slug: "metropolis", year: 1927 },
        { title: "Nosferatu", slug: "nosferatu", year: 1922 },
        { title: "The Cabinet of Dr. Caligari", slug: "the-cabinet-of-dr-caligari", year: 1920 },
        { title: "Sunrise: A Song of Two Humans", slug: "sunrise-a-song-of-two-humans", year: 1927 }
    ];

    // Use username to deterministically select 4 movies
    const seed = username.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const selected = [];
    
    for (let i = 0; i < 4; i++) {
        const index = (seed + (i * 7)) % demoMovies.length;
        selected.push(demoMovies[index]);
    }

    console.log(`[DEMO] Generated demo movies for "${username}":`, selected.map(m => m.title));
    return selected;
}

module.exports = router;
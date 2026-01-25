const express = require('express');
const router = express.Router();
const { getMovieDetails, searchMovieByTitle, calculateRank, TIERS } = require('../services/movieService');

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// =====================================================
// GET /api/search - Search for movies by title
// =====================================================
router.get('/search', async (req, res) => {
    try {
        const query = req.query.q;
        
        if (!query || query.length < 2) {
            return res.json([]);
        }
        
        console.log(`[SEARCH] Searching for: "${query}"`);
        
        // Search TMDB directly
        const response = await fetch(
            `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`
        );
        
        const data = await response.json();
        
        if (!data.results || data.results.length === 0) {
            return res.json([]);
        }
        
        // Get director info for top results
        const movies = await Promise.all(
            data.results.slice(0, 10).map(async (movie) => {
                let director = null;
                try {
                    const creditsRes = await fetch(
                        `${TMDB_BASE_URL}/movie/${movie.id}/credits?api_key=${TMDB_API_KEY}`
                    );
                    const credits = await creditsRes.json();
                    const directorInfo = credits.crew?.find(c => c.job === 'Director');
                    director = directorInfo?.name || null;
                } catch (e) {
                    // Ignore credits errors
                }
                
                return {
                    id: movie.id,
                    title: movie.title,
                    year: movie.release_date ? movie.release_date.substring(0, 4) : null,
                    poster: movie.poster_path 
                        ? `https://image.tmdb.org/t/p/w342${movie.poster_path}`
                        : null,
                    director: director
                };
            })
        );
        
        res.json(movies);
        
    } catch (error) {
        console.error('[SEARCH] Error:', error.message);
        res.status(500).json({ error: 'Search failed' });
    }
});

// =====================================================
// POST /api/analyze - Analyze user's Top 4 movies
// =====================================================
router.post('/analyze', async (req, res) => {
    try {
        const { movieIds } = req.body;
        
        if (!movieIds || movieIds.length !== 4) {
            return res.status(400).json({ 
                error: "Invalid request", 
                message: "Please provide exactly 4 movie IDs" 
            });
        }
        
        console.log(`\n========== Analyzing Top 4 ==========`);
        console.log(`[ANALYZE] Movie IDs: ${movieIds.join(', ')}`);
        
        // Fetch full movie details for each ID
        const moviePromises = movieIds.map(async (id) => {
            try {
                // Get movie details
                const movieRes = await fetch(
                    `${TMDB_BASE_URL}/movie/${id}?api_key=${TMDB_API_KEY}&language=en-US`
                );
                const movieData = await movieRes.json();
                
                // Get credits for directors
                const creditsRes = await fetch(
                    `${TMDB_BASE_URL}/movie/${id}/credits?api_key=${TMDB_API_KEY}`
                );
                const credits = await creditsRes.json();
                
                const directors = credits.crew
                    ?.filter(c => c.job === 'Director')
                    .map(d => d.name) || [];
                
                const releaseYear = movieData.release_date 
                    ? parseInt(movieData.release_date.substring(0, 4)) 
                    : null;
                
                // Calculate rarity score based on popularity
                const popularity = movieData.popularity || 50;
                let rarityScore;
                if (popularity > 100) rarityScore = 10;
                else if (popularity > 50) rarityScore = 20;
                else if (popularity > 20) rarityScore = 35;
                else if (popularity > 10) rarityScore = 50;
                else if (popularity > 5) rarityScore = 65;
                else rarityScore = 80;
                
                // Check if foreign film (non-English)
                const isForeign = movieData.original_language !== 'en';
                
                // Check if black & white (pre-1940 or specific films)
                const isBW = releaseYear && releaseYear < 1940;
                
                console.log(`[ANALYZE] ${movieData.title} (${releaseYear}) - Rating: ${movieData.vote_average}, Rarity: ${rarityScore}`);
                
                return {
                    id: movieData.id,
                    title: movieData.title,
                    release_year: releaseYear,
                    rating: movieData.vote_average?.toFixed(1) || 'N/A',
                    genres: movieData.genres?.map(g => g.name) || [],
                    directors: directors,
                    poster_path: movieData.poster_path 
                        ? `https://image.tmdb.org/t/p/w500${movieData.poster_path}`
                        : null,
                    rarity_score: rarityScore,
                    is_foreign: isForeign,
                    is_bw: isBW,
                    popularity: popularity
                };
            } catch (error) {
                console.error(`[ANALYZE] Error fetching movie ${id}:`, error.message);
                return null;
            }
        });
        
        const movies = (await Promise.all(moviePromises)).filter(m => m !== null);
        
        if (movies.length < 4) {
            return res.status(400).json({ 
                error: "Could not fetch all movies", 
                message: "Some movies could not be found. Please try again." 
            });
        }
        
        // Calculate rank using existing algorithm
        const rankResult = calculateRank(movies);
        
        console.log(`[ANALYZE] Result: Level ${rankResult.level} - ${rankResult.tierName} (Score: ${rankResult.score})`);
        
        res.json({
            movies,
            level: rankResult.level,
            tierName: rankResult.tierName,
            tierIcon: rankResult.tierIcon,
            tierDescription: rankResult.tierDescription,
            tierColor: rankResult.tierColor,
            score: rankResult.score,
            avgRating: rankResult.avgRating,
            scoreBreakdown: rankResult.scoreBreakdown,
            analysis: rankResult.analysis,
            reasons: rankResult.reasons
        });
        
    } catch (error) {
        console.error('[ANALYZE] Error:', error.message);
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

module.exports = router;

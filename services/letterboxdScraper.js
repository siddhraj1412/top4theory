const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Scrapes a user's Top 4 favorite movies from their Letterboxd profile
 * @param {string} username - Letterboxd username
 * @returns {Promise<Array>} Array of movie objects with title and slug
 */
async function scrapeUserTop4(username) {
    try {
        const url = `https://letterboxd.com/${username}/`;
        console.log(`[SCRAPER] Fetching profile: ${url}`);
        
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        const top4Movies = [];

        console.log(`[SCRAPER] Page loaded, searching for favorites...`);

        // Also scrape profile stats while we're here
        const profileStats = scrapeProfileStatsFromPage($, username);

        // Method 1: Look in the favourites section - find poster links
        $('section#favourites li, #favourites li, .favourites li').each((index, element) => {
            if (top4Movies.length >= 4) return false;
            
            // Find the link to the film
            const link = $(element).find('a').first();
            const href = link.attr('href') || '';
            
            // Get image alt text as movie title
            const img = $(element).find('img');
            const filmName = img.attr('alt');
            
            // Extract slug from href (e.g., "/film/the-shawshank-redemption/" -> "the-shawshank-redemption")
            let filmSlug = null;
            if (href.includes('/film/')) {
                filmSlug = href.split('/film/')[1]?.replace(/\/$/, '');
            }
            
            console.log(`[SCRAPER] Method 1 - Found: "${filmName}" slug: "${filmSlug}"`);
            
            if (filmName && filmName.trim()) {
                top4Movies.push({
                    slug: filmSlug || titleToSlug(filmName),
                    title: filmName.trim(),
                    letterboxdUrl: filmSlug ? `https://letterboxd.com/film/${filmSlug}/` : null
                });
            }
        });

        // Method 2: Look for any film posters with data attributes
        if (top4Movies.length === 0) {
            console.log(`[SCRAPER] Trying method 2 - data attributes...`);
            $('[data-film-slug]').slice(0, 4).each((index, element) => {
                const filmSlug = $(element).attr('data-film-slug');
                const img = $(element).find('img');
                const filmName = img.attr('alt') || $(element).attr('data-film-name') || formatSlugToTitle(filmSlug);
                
                console.log(`[SCRAPER] Method 2 - Found: "${filmName}" slug: "${filmSlug}"`);
                
                if (filmSlug && !top4Movies.some(m => m.slug === filmSlug)) {
                    top4Movies.push({
                        slug: filmSlug,
                        title: filmName,
                        letterboxdUrl: `https://letterboxd.com/film/${filmSlug}/`
                    });
                }
            });
        }

        // Method 3: Parse all /film/ links on the page
        if (top4Movies.length === 0) {
            console.log(`[SCRAPER] Trying method 3 - parsing film links...`);
            $('a[href^="/film/"]').each((index, element) => {
                if (top4Movies.length >= 4) return false;
                
                const href = $(element).attr('href');
                const slug = href.replace('/film/', '').replace(/\/$/, '');
                const img = $(element).find('img');
                const filmName = img.attr('alt') || $(element).attr('title') || formatSlugToTitle(slug);
                
                // Skip duplicates and non-movie links
                if (slug && slug !== 'more' && !slug.includes('/') && !top4Movies.some(m => m.slug === slug)) {
                    console.log(`[SCRAPER] Method 3 - Found: "${filmName}" slug: "${slug}"`);
                    top4Movies.push({
                        slug: slug,
                        title: filmName,
                        letterboxdUrl: `https://letterboxd.com/film/${slug}/`
                    });
                }
            });
        }

        console.log(`[SCRAPER] Total unique movies found: ${top4Movies.length}`);
        
        // Also fetch full stats page data
        let fullStats = null;
        try {
            fullStats = await scrapeUserStatsPage(username);
        } catch (e) {
            console.log(`[SCRAPER] Could not fetch stats page: ${e.message}`);
        }
        
        // Merge full stats into profile stats
        if (fullStats) {
            profileStats.topGenres = fullStats.topGenres || [];
            profileStats.topDecades = fullStats.topDecades || [];
            profileStats.topCountries = fullStats.topCountries || [];
            profileStats.hoursWatched = fullStats.hoursWatched || 0;
            profileStats.avgRating = fullStats.avgRating || 0;
            profileStats.mostWatchedDirectors = fullStats.mostWatchedDirectors || [];
        }
        
        // Return first 4 unique movies along with profile stats
        return {
            movies: top4Movies.slice(0, 4),
            profileStats: profileStats
        };
        
    } catch (error) {
        console.error(`[SCRAPER ERROR] ${username}:`, error.message);
        if (error.response?.status === 404) {
            throw new Error(`User "${username}" not found on Letterboxd`);
        }
        throw new Error(`Could not fetch Letterboxd profile: ${error.message}`);
    }
}

/**
 * Scrapes profile statistics from an already-loaded Letterboxd page
 */
function scrapeProfileStatsFromPage($, username) {
    const stats = {
        username: username,
        displayName: '',
        filmsWatched: 0,
        filmsThisYear: 0,
        following: 0,
        followers: 0,
        lists: 0,
        reviews: 0,
        bio: '',
        favoriteFilms: [],
        recentActivity: [],
        // Full profile stats (to be filled from stats page)
        topGenres: [],
        topDecades: [],
        topCountries: [],
        topLanguages: [],
        avgRating: 0,
        hoursWatched: 0,
        mostWatchedDirectors: [],
        mostWatchedActors: []
    };

    try {
        // Get display name
        stats.displayName = $('h1.title-1').text().trim() || 
                           $('.profile-name h1').text().trim() ||
                           username;

        // Get bio
        stats.bio = $('.bio .collapsible-text').text().trim() ||
                   $('.bio').text().trim() || '';

        // Get stats from profile header - look for the stats section
        // Letterboxd shows: Films, This Year, Following, Followers
        $('.profile-stats a, .profile-statistic').each((i, el) => {
            const text = $(el).text().trim().toLowerCase();
            const value = parseInt($(el).find('.value, .statistic').text().replace(/,/g, '')) ||
                         parseInt(text.replace(/[^0-9]/g, '')) || 0;
            
            if (text.includes('film') && !text.includes('year')) {
                stats.filmsWatched = value;
            } else if (text.includes('year')) {
                stats.filmsThisYear = value;
            } else if (text.includes('following')) {
                stats.following = value;
            } else if (text.includes('follower')) {
                stats.followers = value;
            }
        });

        // Alternative method: Parse from navigation links
        $('a[href*="/films/"]').each((i, el) => {
            const href = $(el).attr('href') || '';
            const text = $(el).text().trim();
            if (href.includes(`/${username}/films/`) && !stats.filmsWatched) {
                const num = parseInt(text.replace(/[^0-9]/g, ''));
                if (num > 0) stats.filmsWatched = num;
            }
        });

        // Get from the stats spans directly
        $('h4.profile-statistic span.value, span.value').each((i, el) => {
            const value = parseInt($(el).text().replace(/,/g, '')) || 0;
            const parent = $(el).parent().text().toLowerCase();
            
            if (value > 0) {
                if (parent.includes('film') && !parent.includes('year') && !stats.filmsWatched) {
                    stats.filmsWatched = value;
                } else if (parent.includes('this year') && !stats.filmsThisYear) {
                    stats.filmsThisYear = value;
                } else if (parent.includes('list') && !stats.lists) {
                    stats.lists = value;
                }
            }
        });

        // Try to get review count from reviews link
        $('a[href*="/reviews/"]').each((i, el) => {
            const text = $(el).text().trim();
            const num = parseInt(text.replace(/[^0-9]/g, ''));
            if (num > 0 && !stats.reviews) {
                stats.reviews = num;
            }
        });

        // Try to get lists count
        $('a[href*="/lists/"]').each((i, el) => {
            const text = $(el).text().trim();
            const num = parseInt(text.replace(/[^0-9]/g, ''));
            if (num > 0 && !stats.lists) {
                stats.lists = num;
            }
        });

        console.log(`[SCRAPER] Profile stats for ${username}:`, stats);

    } catch (error) {
        console.error(`[SCRAPER] Error parsing profile stats:`, error.message);
    }

    return stats;
}

/**
 * Scrapes the user's stats page for detailed viewing breakdown
 */
async function scrapeUserStatsPage(username) {
    const statsData = {
        topGenres: [],
        topDecades: [],
        topCountries: [],
        highestRatedGenres: [],
        mostWatchedDirectors: [],
        mostWatchedActors: [],
        hoursWatched: 0,
        avgRating: 0
    };

    try {
        const statsUrl = `https://letterboxd.com/${username}/stats/`;
        console.log(`[SCRAPER] Fetching stats page: ${statsUrl}`);
        
        const response = await axios.get(statsUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            },
            timeout: 15000
        });

        const $ = cheerio.load(response.data);

        // Parse genres from stats
        $('#stats-genres .stat, section.stats-genres .stat, .stats-chart a').each((i, el) => {
            const name = $(el).find('.name, .title').text().trim() || $(el).text().trim();
            const count = parseInt($(el).find('.count').text().replace(/[^0-9]/g, '')) || 0;
            if (name && !name.includes('more') && statsData.topGenres.length < 10) {
                statsData.topGenres.push({ name, count });
            }
        });

        // Parse decades
        $('#stats-decades .stat, section.stats-decades .stat').each((i, el) => {
            const decade = $(el).find('.name, .title').text().trim() || $(el).text().trim();
            const count = parseInt($(el).find('.count').text().replace(/[^0-9]/g, '')) || 0;
            if (decade && decade.match(/\d{4}/) && statsData.topDecades.length < 10) {
                statsData.topDecades.push({ decade, count });
            }
        });

        // Parse countries
        $('#stats-countries .stat, section.stats-countries .stat').each((i, el) => {
            const country = $(el).find('.name, .title').text().trim();
            const count = parseInt($(el).find('.count').text().replace(/[^0-9]/g, '')) || 0;
            if (country && statsData.topCountries.length < 10) {
                statsData.topCountries.push({ country, count });
            }
        });

        // Try to get hours watched
        const hoursText = $('h4:contains("hours"), .statistic:contains("hours")').text();
        const hoursMatch = hoursText.match(/([\d,]+)\s*hours?/i);
        if (hoursMatch) {
            statsData.hoursWatched = parseInt(hoursMatch[1].replace(/,/g, ''));
        }

        // Try to get average rating
        const ratingText = $('h4:contains("average"), .statistic:contains("average")').text();
        const ratingMatch = ratingText.match(/([\d.]+)/);
        if (ratingMatch) {
            statsData.avgRating = parseFloat(ratingMatch[1]);
        }

        // Alternative parsing - look at bar charts
        $('.bar-chart .bar, .stat-bar').each((i, el) => {
            const label = $(el).attr('title') || $(el).find('.label').text().trim();
            const value = parseInt($(el).attr('data-value') || $(el).find('.value').text().replace(/[^0-9]/g, '')) || 0;
            
            if (label && value > 0) {
                // Try to categorize
                if (label.match(/\d{4}s?/) && statsData.topDecades.length < 10) {
                    if (!statsData.topDecades.find(d => d.decade === label)) {
                        statsData.topDecades.push({ decade: label, count: value });
                    }
                }
            }
        });

        // Parse from list sections that show top items
        $('section').each((i, section) => {
            const sectionTitle = $(section).find('h2, h3').first().text().toLowerCase();
            
            if (sectionTitle.includes('genre')) {
                $(section).find('a, .list-item').each((j, el) => {
                    const name = $(el).text().trim();
                    if (name && !name.includes('more') && statsData.topGenres.length < 10) {
                        if (!statsData.topGenres.find(g => g.name === name)) {
                            statsData.topGenres.push({ name, count: 0 });
                        }
                    }
                });
            }
            
            if (sectionTitle.includes('country') || sectionTitle.includes('countr')) {
                $(section).find('a, .list-item').each((j, el) => {
                    const country = $(el).text().trim();
                    if (country && !country.includes('more') && statsData.topCountries.length < 10) {
                        if (!statsData.topCountries.find(c => c.country === country)) {
                            statsData.topCountries.push({ country, count: 0 });
                        }
                    }
                });
            }
        });

        console.log(`[SCRAPER] Stats page - Found ${statsData.topGenres.length} genres, ${statsData.topDecades.length} decades, ${statsData.topCountries.length} countries`);

    } catch (error) {
        console.error(`[SCRAPER] Error fetching stats page:`, error.message);
    }

    return statsData;
}

/**
 * Scrapes full profile statistics from Letterboxd
 */
async function scrapeUserProfile(username) {
    try {
        const url = `https://letterboxd.com/${username}/`;
        console.log(`[SCRAPER] Fetching full profile: ${url}`);
        
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        return scrapeProfileStatsFromPage($, username);

    } catch (error) {
        console.error(`[SCRAPER] Error fetching profile:`, error.message);
        return null;
    }
}

/**
 * Convert a title to a URL-friendly slug
 */
function titleToSlug(title) {
    return title
        .toLowerCase()
        .replace(/['']/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

/**
 * Convert a slug like "the-godfather" to "The Godfather"
 */
function formatSlugToTitle(slug) {
    if (!slug) return 'Unknown';
    return slug
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Scrapes detailed movie information from a Letterboxd film page
 * including the official Letterboxd rating
 */
async function scrapeMovieDetails(slug) {
    try {
        const url = `https://letterboxd.com/film/${slug}/`;
        console.log(`[SCRAPER] Fetching Letterboxd data for: ${slug}`);
        
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        
        // Extract movie title
        const title = $('h1.headline-1').text().trim() || 
                      $('meta[property="og:title"]').attr('content')?.split(' (')[0] ||
                      formatSlugToTitle(slug);
        
        // Get year
        let year = parseInt($('.releaseyear a').text()) || 
                   parseInt($('small.number a').text());
        if (!year) {
            const ogTitle = $('meta[property="og:title"]').attr('content');
            const yearMatch = ogTitle?.match(/\((\d{4})\)/);
            year = yearMatch ? parseInt(yearMatch[1]) : 0;
        }
        
        // Get director(s)
        const directors = [];
        $('a[href*="/director/"]').each((i, el) => {
            const name = $(el).text().trim();
            if (name && !directors.includes(name)) {
                directors.push(name);
            }
        });

        // Get genres
        const genres = [];
        $('a[href*="/films/genre/"]').each((i, el) => {
            const genre = $(el).text().trim();
            if (genre && !genres.includes(genre)) {
                genres.push(genre);
            }
        });

        // Get Letterboxd rating - multiple methods
        let letterboxdRating = null;
        
        // Method 1: Look for the rating in meta tags
        const ratingMeta = $('meta[name="twitter:data2"]').attr('content');
        if (ratingMeta) {
            const ratingMatch = ratingMeta.match(/([\d.]+)\s*out\s*of\s*5/i);
            if (ratingMatch) {
                letterboxdRating = parseFloat(ratingMatch[1]);
            } else {
                // Try direct parse
                const directMatch = ratingMeta.match(/^([\d.]+)/);
                if (directMatch) {
                    letterboxdRating = parseFloat(directMatch[1]);
                }
            }
        }
        
        // Method 2: Look for rating in the page content
        if (!letterboxdRating) {
            const ratingSpan = $('span.average-rating span.rating').text().trim() ||
                              $('a.tooltip.display-rating').text().trim();
            if (ratingSpan) {
                letterboxdRating = parseFloat(ratingSpan);
            }
        }
        
        // Method 3: Look in script/JSON-LD data
        if (!letterboxdRating) {
            $('script[type="application/ld+json"]').each((i, el) => {
                try {
                    const jsonData = JSON.parse($(el).html());
                    if (jsonData.aggregateRating?.ratingValue) {
                        letterboxdRating = parseFloat(jsonData.aggregateRating.ratingValue);
                    }
                } catch (e) {}
            });
        }
        
        // Method 4: Parse from rating histogram section
        if (!letterboxdRating) {
            const histSection = $('.ratings-histogram-chart').attr('data-rating');
            if (histSection) {
                letterboxdRating = parseFloat(histSection);
            }
        }

        console.log(`[SCRAPER] ${title} (${year}) - Letterboxd Rating: ${letterboxdRating || 'N/A'}`);

        return {
            slug,
            title,
            year: year || 0,
            directors: directors.slice(0, 3),
            genres: genres.slice(0, 5),
            letterboxdRating: letterboxdRating,
            letterboxdUrl: url
        };
    } catch (error) {
        console.error(`[SCRAPER] Error scraping movie ${slug}:`, error.message);
        return {
            slug,
            title: formatSlugToTitle(slug),
            year: 0,
            directors: [],
            genres: [],
            letterboxdRating: null,
            letterboxdUrl: `https://letterboxd.com/film/${slug}/`
        };
    }
}

module.exports = { scrapeUserTop4, scrapeUserProfile, scrapeUserStatsPage, scrapeMovieDetails, formatSlugToTitle, titleToSlug };

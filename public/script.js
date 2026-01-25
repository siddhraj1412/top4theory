// =====================================================
// MOVIE SELECTION STATE
// =====================================================
const selectedMovies = {
    1: null,
    2: null,
    3: null,
    4: null
};

let searchTimeout = null;
let activeSlot = null;

// =====================================================
// SEARCH MODAL FUNCTIONS
// =====================================================
function openSearch(slotNum) {
    // Don't open if already has a movie
    if (selectedMovies[slotNum]) {
        return;
    }
    
    activeSlot = slotNum;
    
    const overlay = document.getElementById('searchOverlay');
    const modal = document.getElementById('searchModal');
    const input = document.getElementById('movieSearchInput');
    const results = document.getElementById('searchResults');
    
    // Clear previous search
    input.value = '';
    results.innerHTML = '';
    
    // Show modal
    overlay.classList.add('active');
    modal.classList.add('active');
    
    // Focus input
    setTimeout(() => input.focus(), 100);
}

function closeSearch() {
    const overlay = document.getElementById('searchOverlay');
    const modal = document.getElementById('searchModal');
    
    overlay.classList.remove('active');
    modal.classList.remove('active');
    activeSlot = null;
}

// =====================================================
// SEARCH INPUT HANDLER
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('movieSearchInput');
    
    input.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        
        const resultsContainer = document.getElementById('searchResults');
        
        if (query.length < 2) {
            resultsContainer.innerHTML = '';
            return;
        }
        
        resultsContainer.innerHTML = '<div class="search-loading">🔍 Searching...</div>';
        
        // Debounce search
        searchTimeout = setTimeout(async () => {
            try {
                const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
                const movies = await res.json();
                
                if (movies.length === 0) {
                    resultsContainer.innerHTML = '<div class="no-results">No movies found. Try a different search.</div>';
                    return;
                }
                
                resultsContainer.innerHTML = movies.slice(0, 8).map(movie => `
                    <div class="search-result-item" onclick='selectMovieFromSearch(${JSON.stringify(movie).replace(/'/g, "&#39;")})'>
                        <img class="result-poster" src="${movie.poster || 'https://via.placeholder.com/50x75?text=No+Poster'}" alt="${movie.title}" onerror="this.src='https://via.placeholder.com/50x75?text=No+Poster'">
                        <div class="result-info">
                            <div class="result-title">${movie.title}</div>
                            <div class="result-year">${movie.year || 'Year unknown'}${movie.director ? ' • Directed by ' + movie.director : ''}</div>
                        </div>
                    </div>
                `).join('');
                
            } catch (error) {
                resultsContainer.innerHTML = '<div class="search-error">Search failed. Please try again.</div>';
            }
        }, 300);
    });
    
    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeSearch();
        }
    });
});

// =====================================================
// MOVIE SELECTION
// =====================================================
function selectMovieFromSearch(movie) {
    if (!activeSlot) return;
    
    // Check if movie is already selected in another slot
    for (let i = 1; i <= 4; i++) {
        if (selectedMovies[i] && selectedMovies[i].id === movie.id) {
            alert(`"${movie.title}" is already in slot ${i}`);
            return;
        }
    }
    
    selectedMovies[activeSlot] = movie;
    
    const slot = document.getElementById(`slot-${activeSlot}`);
    slot.classList.remove('empty');
    slot.classList.add('filled');
    
    // Hide empty state, show selected movie
    const emptyState = slot.querySelector('.empty-state');
    const selectedDisplay = slot.querySelector('.selected-movie');
    
    emptyState.style.display = 'none';
    
    // Show selected movie
    selectedDisplay.style.display = 'flex';
    selectedDisplay.querySelector('.selected-poster').src = movie.poster || 'https://via.placeholder.com/60x90?text=No+Poster';
    selectedDisplay.querySelector('.selected-title').textContent = movie.title;
    selectedDisplay.querySelector('.selected-year').textContent = movie.year || '';
    
    // Close search modal
    closeSearch();
    
    updateCounter();
}

function removeMovie(slotNum) {
    selectedMovies[slotNum] = null;
    
    const slot = document.getElementById(`slot-${slotNum}`);
    slot.classList.add('empty');
    slot.classList.remove('filled');
    
    const emptyState = slot.querySelector('.empty-state');
    const selectedDisplay = slot.querySelector('.selected-movie');
    
    emptyState.style.display = '';
    selectedDisplay.style.display = 'none';
    
    updateCounter();
}

function updateCounter() {
    const count = Object.values(selectedMovies).filter(m => m !== null).length;
    document.getElementById('selectedCount').textContent = count;
    document.getElementById('analyzeBtn').disabled = count < 4;
}

// =====================================================
// ANALYZE TOP 4
// =====================================================
async function analyzeTop4() {
    const movies = Object.values(selectedMovies).filter(m => m !== null);
    
    if (movies.length < 4) {
        showError("Please select 4 movies");
        return;
    }
    
    // Show loading state
    const btn = document.getElementById('analyzeBtn');
    const btnText = btn.querySelector('.btn-text');
    const btnLoader = btn.querySelector('.btn-loader');
    
    btnText.classList.add('hidden');
    btnLoader.classList.remove('hidden');
    btn.disabled = true;
    
    hideError();
    document.getElementById('result').classList.add('hidden');
    
    try {
        const movieIds = movies.map(m => m.id);
        
        const res = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ movieIds })
        });
        
        const data = await res.json();
        
        if (!res.ok) {
            throw new Error(data.message || data.error || "Failed to analyze movies");
        }
        
        displayResults(data);
        
    } catch (error) {
        showError(error.message);
    } finally {
        btnText.classList.remove('hidden');
        btnLoader.classList.add('hidden');
        btn.disabled = false;
    }
}

// =====================================================
// DISPLAY RESULTS
// =====================================================
function displayResults(data) {
    // Set tier info
    document.getElementById('levelVal').innerText = data.level;
    document.getElementById('tierName').innerText = data.tierName;
    document.getElementById('tierIcon').innerText = data.tierIcon;
    document.getElementById('tierDescription').innerText = data.tierDescription;
    
    // Set scores
    document.getElementById('scoreVal').innerText = data.score;
    
    // Display average rating as stars
    const avgRatingNum = parseFloat(data.avgRating) || 0;
    document.getElementById('avgRating').innerText = getStarDisplay(avgRatingNum) + ` (${data.avgRating})`;
    
    // Apply tier color styling
    const rankCard = document.getElementById('rankCard');
    rankCard.style.setProperty('--tier-color', data.tierColor);
    rankCard.style.setProperty('--tier-color-glow', data.tierColor + '40');
    
    const tierBadge = document.getElementById('tierBadge');
    tierBadge.style.borderColor = data.tierColor;
    tierBadge.style.boxShadow = `0 0 40px ${data.tierColor}40`;
    
    document.getElementById('tierName').style.color = data.tierColor;
    
    // Display analysis grid
    const analysisGrid = document.getElementById('analysisGrid');
    analysisGrid.innerHTML = '';
    
    if (data.analysis) {
        const analysisItems = [
            { label: 'Genres', value: data.analysis.genreCount || 0 },
            { label: 'Avg Year Gap', value: (data.analysis.avgYearGap || 0) + ' yrs', tooltip: 'Average years between your films' },
            { label: 'Oldest Film', value: data.analysis.oldestFilm || 'N/A' },
            { label: 'Newest Film', value: data.analysis.newestFilm || 'N/A' },
            { label: 'Rarity Avg', value: data.analysis.avgRarity || 0 },
            { label: 'Famous Directors', value: data.analysis.auteurCount || 0, tooltip: 'Films by well-known directors' }
        ];
        
        analysisItems.forEach(item => {
            const div = document.createElement('div');
            div.className = 'analysis-item';
            if (item.tooltip) {
                div.title = item.tooltip;
                div.style.cursor = 'help';
            }
            div.innerHTML = `
                <div class="analysis-value">${item.value}</div>
                <div class="analysis-label">${item.label}</div>
            `;
            analysisGrid.appendChild(div);
        });
        
        // Add special badges
        if (data.analysis.hasForeign) addAnalysisItem(analysisGrid, '🌍', 'Foreign Film');
        if (data.analysis.hasClassic) addAnalysisItem(analysisGrid, '🎞️', 'Classic Era');
        if (data.analysis.hasSilentOrBW) addAnalysisItem(analysisGrid, '⬛', 'B&W/Silent');
    }
    
    // Display reasons
    const reasonsList = document.getElementById('reasonsList');
    reasonsList.innerHTML = '';
    if (data.reasons && data.reasons.length > 0) {
        data.reasons.forEach(reason => {
            const li = document.createElement('li');
            li.textContent = reason;
            reasonsList.appendChild(li);
        });
    }
    
    // Display movies with clickable titles
    const movieGrid = document.getElementById('movieGrid');
    movieGrid.innerHTML = '';
    if (data.movies && data.movies.length > 0) {
        data.movies.forEach(movie => {
            const movieCard = document.createElement('div');
            movieCard.className = 'movie-card';
            const posterUrl = movie.poster_path || 'https://via.placeholder.com/200x300?text=No+Poster';
            // Create Letterboxd URL from movie title and year
            const letterboxdSlug = movie.title.toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-');
            const letterboxdUrl = `https://letterboxd.com/film/${letterboxdSlug}/`;
            
            movieCard.innerHTML = `
                <a href="${letterboxdUrl}" target="_blank" class="poster-link">
                    <div class="poster-container">
                        <img class="movie-poster" src="${posterUrl}" alt="${movie.title}" onerror="this.src='https://via.placeholder.com/200x300?text=No+Poster'">
                    </div>
                </a>
                <div class="movie-info">
                    <a href="${letterboxdUrl}" target="_blank" class="movie-title-link">
                        ${movie.title}
                    </a>
                    <div class="movie-year">${movie.release_year || 'N/A'}</div>
                    <div class="movie-genres">${(movie.genres || []).slice(0, 3).join(', ')}</div>
                    ${movie.directors && movie.directors.length > 0 ? `<div class="movie-director">🎬 ${movie.directors.join(', ')}</div>` : ''}
                </div>
            `;
            movieGrid.appendChild(movieCard);
        });
    }
    
    // Display tier explanation with factors and progress bar
    const tierExplanation = document.getElementById('tierExplanation');
    if (tierExplanation) {
        tierExplanation.textContent = getTierExplanation(data.level, data.score, data.analysis);
    }
    
    // Display tier factors (bullet points)
    const tierFactors = document.getElementById('tierFactors');
    if (tierFactors && data.analysis) {
        const analysis = data.analysis;
        let factorsHTML = '';
        
        // Genre Diversity
        const genreText = analysis.genreCount >= 7 ? 'excellent variety' : 
                         analysis.genreCount >= 5 ? 'decent variety' : 'limited variety';
        factorsHTML += `<li><span class="factor-icon">🎬</span> <strong>Genre Diversity:</strong> ${analysis.genreCount} genres - ${genreText}</li>`;
        
        // Era Span
        const eraText = analysis.yearSpread >= 50 ? 'impressive range across eras' :
                       analysis.yearSpread >= 25 ? 'good exploration of different periods' :
                       `Only ${analysis.yearSpread} years - consider exploring different eras`;
        factorsHTML += `<li><span class="factor-icon">📅</span> <strong>Era Span:</strong> ${eraText}</li>`;
        
        // International Cinema
        if (analysis.hasForeign) {
            factorsHTML += `<li><span class="factor-icon">✅</span> <strong>International Cinema:</strong> ${analysis.auteurCount > 0 ? 'Multiple' : '1'} non-English film - you explore world cinema!</li>`;
        }
        
        // Famous Directors
        if (analysis.auteurCount > 0) {
            factorsHTML += `<li><span class="factor-icon">🎥</span> <strong>Famous Directors:</strong> ${analysis.auteurCount} renowned filmmaker${analysis.auteurCount > 1 ? 's' : ''} in your picks</li>`;
        }
        
        // Classic Cinema
        if (analysis.hasClassic) {
            factorsHTML += `<li><span class="factor-icon">🎞️</span> <strong>Classic Cinema:</strong> Includes pre-1970s films - you appreciate film history!</li>`;
        }
        
        tierFactors.innerHTML = factorsHTML;
    }
    
    // Display level progress bar
    const levelProgressFill = document.getElementById('levelProgressFill');
    const levelScoreDisplay = document.getElementById('levelScoreDisplay');
    if (levelProgressFill && levelScoreDisplay) {
        const scorePercent = Math.min(100, Math.max(0, data.score));
        levelProgressFill.style.width = `${scorePercent}%`;
        levelScoreDisplay.textContent = `Score: ${data.score}/100`;
    }
    
    // Display taste profile
    const tasteDescription = document.getElementById('tasteDescription');
    const tasteStats = document.getElementById('tasteStats');
    if (tasteDescription && tasteStats && data.analysis && data.movies) {
        // Get top genres
        const allGenres = data.movies.flatMap(m => m.genres || []);
        const genreCounts = {};
        allGenres.forEach(g => genreCounts[g] = (genreCounts[g] || 0) + 1);
        const topGenres = Object.entries(genreCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([g]) => g);
        
        // Determine era preference
        const avgYear = data.movies.reduce((sum, m) => sum + (m.release_year || 2000), 0) / data.movies.length;
        let eraPreference = avgYear >= 2010 ? '2010s+ contemporary' :
                          avgYear >= 2000 ? '2000s modern classics' :
                          avgYear >= 1990 ? '90s cinema' :
                          avgYear >= 1980 ? '80s films' :
                          avgYear >= 1970 ? '70s New Hollywood' : 'Classic cinema';
        
        // Cultural scope
        const culturalScope = data.analysis.hasForeign ? 'International curious' : 'Hollywood focused';
        
        // Build description
        const genreList = topGenres.length > 0 ? topGenres.join(', ') : 'various genres';
        let description = `Your favorites center around <strong>${genreList}</strong>.`;
        if (data.analysis.hasForeign) {
            description += ` You're open to international films, which shows cultural curiosity.`;
        }
        tasteDescription.innerHTML = description;
        
        // Build stats cards
        const primaryGenre = topGenres[0] || 'Mixed';
        const genreCount = genreCounts[primaryGenre] || 0;
        
        tasteStats.innerHTML = `
            <div class="taste-stat">
                <span class="taste-stat-icon">🎭</span>
                <span class="taste-stat-label">Primary Genre</span>
                <span class="taste-stat-value">${primaryGenre} (${genreCount}/4 films)</span>
            </div>
            <div class="taste-stat">
                <span class="taste-stat-icon">⏰</span>
                <span class="taste-stat-label">Era Preference</span>
                <span class="taste-stat-value">${eraPreference}</span>
            </div>
            <div class="taste-stat">
                <span class="taste-stat-icon">🌍</span>
                <span class="taste-stat-label">Cultural Scope</span>
                <span class="taste-stat-value">${culturalScope}</span>
            </div>
        `;
    }
    
    // Display score breakdown with progress bars
    const breakdownContainer = document.getElementById('scoreBreakdown');
    if (breakdownContainer && data.scoreBreakdown) {
        const sb = data.scoreBreakdown;
        const analysis = data.analysis || {};
        
        // Build descriptive subtitles for each category
        const ratingSubtitle = `${(parseFloat(data.avgRating) * 2).toFixed(1)} avg rating`;
        const genreSubtitle = `${analysis.genreCount || 0} unique genres`;
        const raritySubtitle = sb.rarity >= 10 ? 'Beyond mainstream picks' : 'Popular selections';
        const eraSubtitle = `${analysis.yearSpread || 0} year span`;
        
        // Build cinephile traits subtitle
        let traitsDetails = [];
        if (analysis.hasForeign) traitsDetails.push('foreign');
        if (analysis.hasClassic) traitsDetails.push('classic');
        if (analysis.auteurCount > 0) traitsDetails.push(`${analysis.auteurCount} famous director${analysis.auteurCount > 1 ? 's' : ''}`);
        const traitsSubtitle = traitsDetails.length > 0 ? traitsDetails.join(', ') : 'No special traits';
        
        breakdownContainer.innerHTML = `
            <div class="breakdown-row">
                <div class="breakdown-header">
                    <span class="breakdown-label">Film Quality</span>
                    <span class="breakdown-points">+${sb.rating || 0} pts</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${(sb.rating / 20) * 100}%"></div>
                </div>
                <span class="breakdown-subtitle">${ratingSubtitle}</span>
            </div>
            
            <div class="breakdown-row">
                <div class="breakdown-header">
                    <span class="breakdown-label">Genre Diversity</span>
                    <span class="breakdown-points">+${sb.genre || 0} pts</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${(sb.genre / 20) * 100}%"></div>
                </div>
                <span class="breakdown-subtitle">${genreSubtitle}</span>
            </div>
            
            <div class="breakdown-row">
                <div class="breakdown-header">
                    <span class="breakdown-label">Hidden Gems</span>
                    <span class="breakdown-points">+${sb.rarity || 0} pts</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${(sb.rarity / 20) * 100}%"></div>
                </div>
                <span class="breakdown-subtitle">${raritySubtitle}</span>
            </div>
            
            <div class="breakdown-row">
                <div class="breakdown-header">
                    <span class="breakdown-label">Era Range</span>
                    <span class="breakdown-points">+${sb.era || 0} pts</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${(sb.era / 20) * 100}%"></div>
                </div>
                <span class="breakdown-subtitle">${eraSubtitle}</span>
            </div>
            
            <div class="breakdown-row">
                <div class="breakdown-header">
                    <span class="breakdown-label">Cinephile Traits</span>
                    <span class="breakdown-points">+${sb.traits || 0} pts</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${(sb.traits / 20) * 100}%"></div>
                </div>
                <span class="breakdown-subtitle">${traitsSubtitle}</span>
            </div>
            
            ${sb.penalty > 0 ? `
            <div class="breakdown-row penalty">
                <div class="breakdown-header">
                    <span class="breakdown-label">Franchise Penalty</span>
                    <span class="breakdown-points penalty-text">-${sb.penalty} pts</span>
                </div>
                <div class="progress-bar penalty-bar">
                    <div class="progress-fill penalty-fill" style="width: ${(sb.penalty / 12) * 100}%"></div>
                </div>
                <span class="breakdown-subtitle">Multiple franchise films</span>
            </div>
            ` : ''}
            
            <div class="breakdown-total-row">
                <span class="total-label">Total Score</span>
                <span class="total-value">${sb.finalScore || 0} / 100</span>
            </div>
        `;
    }
    
    // Show results
    document.getElementById('result').classList.remove('hidden');
    document.getElementById('result').scrollIntoView({ behavior: 'smooth' });
}

// Get tier explanation based on level
function getTierExplanation(level, score, analysis) {
    const explanations = {
        1: "Your Top 4 consists mostly of mainstream popular films. There's a whole world of cinema waiting to be explored!",
        2: "You enjoy popular movies and have started developing your taste. Keep exploring different genres and eras!",
        3: "Your taste shows solid foundations with some variety. You're on your way to becoming a true cinephile.",
        4: "You appreciate variety across genres and eras. Your Top 4 shows you're willing to explore beyond the mainstream.",
        5: "You dig deeper than most viewers. Your selections show genuine appreciation for quality filmmaking.",
        6: "Your taste is sharp and intentional. You've clearly developed an eye for quality cinema.",
        7: "You have excellent, well-rounded taste. Your Top 4 demonstrates deep appreciation for the art of film.",
        8: "Your picks show deep film appreciation. You understand what makes cinema truly special.",
        9: "You see cinema on another level. Your selections reveal a sophisticated understanding of film as art.",
        10: "Your taste is legendary. Your Top 4 represents the pinnacle of cinematic appreciation."
    };
    return explanations[level] || explanations[1];
}

function addAnalysisItem(grid, icon, label) {
    const div = document.createElement('div');
    div.className = 'analysis-item badge';
    div.innerHTML = `
        <div class="analysis-value">${icon}</div>
        <div class="analysis-label">${label}</div>
    `;
    grid.appendChild(div);
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================
function getStarDisplay(rating) {
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.5;
    let stars = '★'.repeat(fullStars);
    if (halfStar) stars += '½';
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
    stars += '☆'.repeat(Math.max(0, emptyStars));
    return stars;
}

function showError(message) {
    const errorBox = document.getElementById('error');
    errorBox.textContent = message;
    errorBox.classList.remove('hidden');
}

function hideError() {
    document.getElementById('error').classList.add('hidden');
}

// =====================================================
// SCREENSHOT FUNCTION
// =====================================================
async function takeScreenshot() {
    const shareableContent = document.getElementById('shareableContent');
    const btn = document.querySelector('.screenshot-btn');
    const originalText = btn.innerHTML;
    
    try {
        btn.innerHTML = '⏳ Generating...';
        btn.disabled = true;
        
        // Add screenshot mode class for styling
        shareableContent.classList.add('screenshot-mode');
        
        // Use html2canvas to capture
        const canvas = await html2canvas(shareableContent, {
            backgroundColor: '#14181c',
            scale: 2,
            useCORS: true,
            allowTaint: true,
            logging: false
        });
        
        // Remove screenshot mode
        shareableContent.classList.remove('screenshot-mode');
        
        // Convert to image and download
        const link = document.createElement('a');
        link.download = 'my-top4-theory.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        btn.innerHTML = '✅ Saved!';
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }, 2000);
        
    } catch (error) {
        console.error('Screenshot error:', error);
        shareableContent.classList.remove('screenshot-mode');
        btn.innerHTML = '❌ Failed';
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }, 2000);
    }
}

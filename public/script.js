async function fetchRank() {
    const username = document.getElementById('username').value.trim();
    if (!username) {
        showError("Please enter a Letterboxd username");
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
        const res = await fetch(`/api/rank/${encodeURIComponent(username)}`);
        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.message || data.error || "Failed to analyze profile");
        }

        // Display results
        displayResults(data);

    } catch (error) {
        showError(error.message);
    } finally {
        btnText.classList.remove('hidden');
        btnLoader.classList.add('hidden');
        btn.disabled = false;
    }
}

function displayResults(data) {
    // Set username
    document.getElementById('displayUser').innerText = data.username;
    
    // Set tier info
    document.getElementById('levelVal').innerText = data.level;
    document.getElementById('tierName').innerText = data.tierName;
    document.getElementById('tierIcon').innerText = data.tierIcon;
    document.getElementById('tierDescription').innerText = data.tierDescription;
    
    // Set scores
    document.getElementById('scoreVal').innerText = data.score;
    
    // Display average rating as Letterboxd-style stars with clear labeling
    const avgRatingNum = parseFloat(data.avgRating) || 0;
    const tmdbRating = (avgRatingNum * 2).toFixed(1); // Convert 5-star to 10-point scale
    document.getElementById('avgRating').innerHTML = getStarDisplay(avgRatingNum) + ` <span class="rating-detail">${data.avgRating}/5 (${tmdbRating}/10 on TMDB)</span>`;
    
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
            { label: 'Year Span', value: data.analysis.yearSpread || 0 },
            { label: 'Oldest Film', value: data.analysis.oldestFilm || 'N/A' },
            { label: 'Newest Film', value: data.analysis.newestFilm || 'N/A' },
            { label: 'Rarity Avg', value: data.analysis.avgRarity || 0 },
            { label: 'Famous Directors', value: data.analysis.auteurCount || 0, tooltip: 'Films by renowned directors like Kubrick, Scorsese, Tarantino, etc.' }
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
        if (data.analysis.hasForeign) {
            addAnalysisItem(analysisGrid, '🌍', 'Foreign Film');
        }
        if (data.analysis.hasClassic) {
            addAnalysisItem(analysisGrid, '📜', 'Pre-1970 Classic');
        }
        if (data.analysis.hasSilentOrBW) {
            addAnalysisItem(analysisGrid, '🎬', 'Silent/B&W Era');
        }
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

    // Display movies
    const movieGrid = document.getElementById('movieGrid');
    movieGrid.innerHTML = '';
    
    if (data.movies && data.movies.length > 0) {
        data.movies.forEach(movie => {
            const div = document.createElement('div');
            div.className = 'movie-card';
            
            const posterContent = movie.poster_path
                ? `<div class="poster" style="background-image: url('${movie.poster_path}')"></div>`
                : `<div class="poster"><div class="poster-placeholder">🎬</div></div>`;
            
            const badges = [];
            if (movie.is_foreign) badges.push('<span class="badge badge-foreign">Foreign</span>');
            if (movie.release_year < 1970) badges.push('<span class="badge badge-classic">Classic</span>');
            if (movie.rarity_score >= 50 && parseFloat(movie.rating) >= 7.5) badges.push('<span class="badge badge-rare">Hidden Gem</span>');
            
            const genres = Array.isArray(movie.genres) ? movie.genres.slice(0, 3).join(', ') : '';
            const directors = Array.isArray(movie.directors) ? movie.directors.slice(0, 2).join(', ') : '';
            
            // Only show rating if official Letterboxd rating is available
            let ratingDisplay = '';
            if (movie.letterboxd_rating) {
                const starRating = parseFloat(movie.letterboxd_rating);
                ratingDisplay = `<span class="movie-rating" title="Letterboxd Rating">${starRating.toFixed(1)}</span>`;
            }
            
            // Make movie card clickable to Letterboxd
            const movieUrl = movie.letterboxd_url || '#';
            
            div.innerHTML = `
                <a href="${movieUrl}" target="_blank" rel="noopener" class="movie-link">
                    <div class="poster-container">
                        ${posterContent}
                        <div class="movie-badges">${badges.join('')}</div>
                    </div>
                    <div class="movie-info">
                        <div class="movie-title">${movie.title}</div>
                        <div class="movie-meta">
                            <span class="movie-year">${movie.release_year}</span>
                            ${ratingDisplay}
                        </div>
                        ${genres ? `<div class="movie-genres">${genres}</div>` : ''}
                        ${directors ? `<div class="movie-directors">Dir: ${directors}</div>` : ''}
                    </div>
                </a>
            `;
            
            movieGrid.appendChild(div);
        });
    }

    // Display full profile analysis
    displayProfileAnalysis(data);

    // Show results with animation
    document.getElementById('result').classList.remove('hidden');
    
    // Scroll to results
    document.getElementById('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function displayProfileAnalysis(data) {
    // Display Full Profile Breakdown only
    displayFullProfileAnalysis(data);
}

// ============================================
// FULL PROFILE BREAKDOWN WITH DETAILED INSIGHTS
// ============================================
function displayFullProfileAnalysis(data) {
    const container = document.getElementById('profileAnalysisContent');
    container.innerHTML = '';
    
    const profileStats = data.profileStats || {};
    const movies = data.movies || [];
    const analysis = data.analysis || {};
    
    let html = '';
    
    // 1. Watcher Experience Level - Detailed explanation
    const filmsWatched = profileStats.filmsWatched || 0;
    const watcherInsight = getWatcherInsight(filmsWatched);
    
    html += `
        <div class="analysis-category">
            <div class="analysis-category-title">🎬 Watcher Experience</div>
            <div class="analysis-category-content">
                <div class="insight-badge ${watcherInsight.class}">${watcherInsight.badge}</div>
                <div class="insight-explanation">
                    <p><strong>Why this level?</strong></p>
                    <p>${watcherInsight.explanation}</p>
                </div>
                ${filmsWatched > 0 ? `
                <div class="profile-stats-grid" style="margin-top: 15px;">
                    <div class="profile-stat">
                        <span class="stat-value">${filmsWatched.toLocaleString()}</span>
                        <span class="stat-label">Films Logged</span>
                    </div>
                    ${profileStats.filmsThisYear > 0 ? `
                    <div class="profile-stat">
                        <span class="stat-value">${profileStats.filmsThisYear}</span>
                        <span class="stat-label">This Year</span>
                    </div>
                    ` : ''}
                    ${profileStats.followers > 0 ? `
                    <div class="profile-stat">
                        <span class="stat-value">${profileStats.followers.toLocaleString()}</span>
                        <span class="stat-label">Followers</span>
                    </div>
                    ` : ''}
                </div>
                ` : ''}
            </div>
        </div>
    `;
    
    // 2. Tier Explanation - Why they got this specific tier
    const tierInsight = getTierInsight(data.level, data.score, analysis, movies);
    html += `
        <div class="analysis-category">
            <div class="analysis-category-title">${data.tierIcon} ${data.tierName}</div>
            <div class="analysis-category-content">
                <div class="tier-badge-container">
                    <div class="insight-badge tier-badge" style="background: ${data.tierColor}; border-color: ${data.tierColor};">
                        <span class="tier-emoji">${data.tierIcon}</span>
                        <span class="tier-level-text">Level ${data.level}</span>
                    </div>
                </div>
                <div class="insight-explanation">
                    <p><strong>Why this tier?</strong></p>
                    <p>${tierInsight.mainReason}</p>
                    <ul class="insight-list">
                        ${tierInsight.factors.map(f => `<li>${f}</li>`).join('')}
                    </ul>
                </div>
                <div class="analysis-bar" style="margin-top: 15px;">
                    <div class="analysis-bar-fill" style="width: ${Math.min(100, data.score)}%"></div>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 5px; font-size: 0.8rem;">
                    <span>Level 1</span>
                    <span style="color: #00e054; font-weight: 600;">Score: ${data.score}/100</span>
                    <span>Level 10</span>
                </div>
            </div>
        </div>
    `;
    
    // 3. Taste Profile - What your Top 4 reveals
    const tasteInsight = getTasteInsight(movies, analysis);
    html += `
        <div class="analysis-category">
            <div class="analysis-category-title">🎭 Your Taste Profile</div>
            <div class="analysis-category-content">
                <div class="insight-explanation">
                    <p><strong>What your Top 4 reveals:</strong></p>
                    <p>${tasteInsight.summary}</p>
                </div>
                ${tasteInsight.traits.length > 0 ? `
                <div class="taste-traits">
                    ${tasteInsight.traits.map(t => `
                        <div class="taste-trait">
                            <span class="trait-icon">${t.icon}</span>
                            <span class="trait-label">${t.label}</span>
                            <span class="trait-desc">${t.desc}</span>
                        </div>
                    `).join('')}
                </div>
                ` : ''}
            </div>
        </div>
    `;
    
    // 4. Score Breakdown - How the score was calculated
    html += `
        <div class="analysis-category">
            <div class="analysis-category-title">📊 Score Breakdown</div>
            <div class="analysis-category-content">
                <div class="insight-explanation">
                    <p><strong>How we calculated your score:</strong></p>
                </div>
                <div class="score-factors">
                    ${getScoreFactors(analysis, movies, data.score)}
                </div>
            </div>
        </div>
    `;
    
    // 5. Tips to improve (if not at max level)
    if (data.level < 10) {
        const tips = getImprovementTips(data.level, analysis, movies);
        html += `
            <div class="analysis-category" style="border-left-color: #f5c518;">
                <div class="analysis-category-title">💡 How to Level Up</div>
                <div class="analysis-category-content">
                    <div class="insight-explanation">
                        <p><strong>Tips to reach Level ${data.level + 1}:</strong></p>
                        <ul class="insight-list tips-list">
                            ${tips.map(t => `<li>${t}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Link to Letterboxd
    if (data.username) {
        html += `
            <div class="analysis-category" style="border-left-color: #00e054;">
                <div class="analysis-category-content">
                    <p style="margin: 0;">
                        🔗 <a href="https://letterboxd.com/${data.username}/" target="_blank" style="color: #00e054; text-decoration: none;">
                            View full profile on Letterboxd →
                        </a>
                    </p>
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

// Helper: Get detailed watcher insight based on films watched
function getWatcherInsight(filmsWatched) {
    if (filmsWatched >= 5000) {
        return {
            badge: '🏆 Legendary Cinephile',
            class: 'legendary',
            explanation: `With over ${filmsWatched.toLocaleString()} films logged, you're in the top 0.1% of movie watchers globally. You've dedicated thousands of hours to cinema and have likely seen films from every era, genre, and country. Your knowledge rivals professional film critics and historians.`
        };
    } else if (filmsWatched >= 2500) {
        return {
            badge: '🎬 Expert Viewer',
            class: 'expert',
            explanation: `${filmsWatched.toLocaleString()} films is exceptional! At roughly 3-4 films per week for over a decade, you've built an encyclopedic knowledge of cinema. You can discuss obscure gems alongside mainstream hits and likely have strong opinions about film theory.`
        };
    } else if (filmsWatched >= 1000) {
        return {
            badge: '🎞️ Dedicated Cinephile',
            class: 'dedicated',
            explanation: `Crossing 1,000 films is a major milestone! You watch about 2-3 films weekly and have explored beyond just popular releases. Your taste is likely well-developed, and you appreciate the craft behind filmmaking.`
        };
    } else if (filmsWatched >= 500) {
        return {
            badge: '🎥 Film Enthusiast',
            class: 'enthusiast',
            explanation: `${filmsWatched} films shows genuine passion for movies. You're past casual viewing and actively seek out new films. You probably have favorite directors, genres, and can recommend hidden gems to friends.`
        };
    } else if (filmsWatched >= 100) {
        return {
            badge: '🍿 Active Viewer',
            class: 'regular',
            explanation: `With ${filmsWatched} films, you're building a solid foundation. You watch regularly and are starting to develop personal taste. Keep exploring different genres and eras to expand your cinematic horizons!`
        };
    } else if (filmsWatched > 0) {
        return {
            badge: '🌟 Newcomer',
            class: 'newcomer',
            explanation: `Welcome to the world of cinema! You've logged ${filmsWatched} films so far. Every movie watched is a new adventure. The best part? You have countless classics and hidden gems waiting to be discovered!`
        };
    } else {
        return {
            badge: '📽️ Getting Started',
            class: 'newcomer',
            explanation: `Your film journey is just beginning! Start logging the movies you watch to track your progress and discover patterns in your taste.`
        };
    }
}

// Helper: Get tier insight with detailed reasons
function getTierInsight(level, score, analysis, movies) {
    const factors = [];
    let mainReason = '';
    
    // Analyze what contributed to their score
    const genreCount = analysis.genreCount || 0;
    const yearSpread = analysis.yearSpread || 0;
    const auteurCount = analysis.auteurCount || 0;
    const foreignCount = movies.filter(m => m.is_foreign).length;
    const classicCount = movies.filter(m => m.release_year < 1970).length;
    const avgRarity = analysis.avgRarity || 0;
    
    if (level >= 8) {
        mainReason = `Your Top 4 demonstrates exceptional taste with a perfect blend of diversity, depth, and cultural appreciation. You've chosen films that show genuine understanding of cinema as an art form.`;
    } else if (level >= 6) {
        mainReason = `Your selections show strong cinematic taste with good variety and some adventurous choices. You balance popular favorites with more distinctive picks.`;
    } else if (level >= 4) {
        mainReason = `Your Top 4 shows solid movie taste with room to explore more diverse cinema. You have a foundation of well-regarded films.`;
    } else {
        mainReason = `Your Top 4 consists mainly of popular, mainstream films. While these are great movies, exploring beyond the blockbusters would reveal your deeper taste.`;
    }
    
    // Add specific factors
    if (genreCount >= 6) {
        factors.push(`✅ <strong>Genre Diversity:</strong> ${genreCount} different genres - excellent variety!`);
    } else if (genreCount >= 4) {
        factors.push(`📊 <strong>Genre Diversity:</strong> ${genreCount} genres - decent variety`);
    } else {
        factors.push(`📉 <strong>Genre Diversity:</strong> Only ${genreCount} genres - try branching out`);
    }
    
    if (yearSpread > 30) {
        factors.push(`✅ <strong>Era Span:</strong> ${yearSpread} years between oldest and newest - great historical range!`);
    } else if (yearSpread > 15) {
        factors.push(`📊 <strong>Era Span:</strong> ${yearSpread} years - moderate time range`);
    } else {
        factors.push(`📉 <strong>Era Span:</strong> Only ${yearSpread} years - consider exploring different eras`);
    }
    
    if (foreignCount > 0) {
        factors.push(`✅ <strong>International Cinema:</strong> ${foreignCount} non-English film${foreignCount > 1 ? 's' : ''} - you explore world cinema!`);
    } else {
        factors.push(`📉 <strong>International Cinema:</strong> No foreign films - a whole world awaits!`);
    }
    
    if (auteurCount > 0) {
        factors.push(`✅ <strong>Auteur Directors:</strong> ${auteurCount} film${auteurCount > 1 ? 's' : ''} from acclaimed directors`);
    }
    
    if (classicCount > 0) {
        factors.push(`✅ <strong>Classic Cinema:</strong> ${classicCount} pre-1970 classic${classicCount > 1 ? 's' : ''} - respect for film history!`);
    }
    
    if (avgRarity > 40) {
        factors.push(`✅ <strong>Hidden Gems:</strong> Your picks include lesser-known films - adventurous taste!`);
    } else if (avgRarity < 20) {
        factors.push(`📊 <strong>Popularity:</strong> Your picks are well-known favorites - safe but solid choices`);
    }
    
    return { mainReason, factors };
}

// Helper: Get taste profile insight
function getTasteInsight(movies, analysis) {
    const traits = [];
    let summary = '';
    
    // Collect data
    const allGenres = [];
    const allDirectors = [];
    movies.forEach(m => {
        if (Array.isArray(m.genres)) allGenres.push(...m.genres);
        if (Array.isArray(m.directors)) allDirectors.push(...m.directors);
    });
    
    const years = movies.map(m => m.release_year).filter(y => y > 0);
    const avgYear = years.length > 0 ? Math.round(years.reduce((a, b) => a + b, 0) / years.length) : 2000;
    const foreignCount = movies.filter(m => m.is_foreign).length;
    
    // Genre preference
    const genreCounts = {};
    allGenres.forEach(g => genreCounts[g] = (genreCounts[g] || 0) + 1);
    const topGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
    
    if (topGenres.length > 0) {
        const primaryGenre = topGenres[0][0];
        traits.push({
            icon: '🎭',
            label: 'Primary Genre',
            desc: `${primaryGenre} (${topGenres[0][1]}/4 films)`
        });
    }
    
    // Era preference
    if (avgYear < 1980) {
        traits.push({ icon: '📜', label: 'Era Preference', desc: 'Classic cinema lover' });
    } else if (avgYear < 2000) {
        traits.push({ icon: '📼', label: 'Era Preference', desc: '80s-90s golden age fan' });
    } else if (avgYear < 2015) {
        traits.push({ icon: '💿', label: 'Era Preference', desc: '2000s modern classics' });
    } else {
        traits.push({ icon: '🎞️', label: 'Era Preference', desc: 'Contemporary cinema' });
    }
    
    // Cultural taste
    if (foreignCount >= 2) {
        traits.push({ icon: '🌍', label: 'Cultural Scope', desc: 'World cinema explorer' });
    } else if (foreignCount === 1) {
        traits.push({ icon: '🗺️', label: 'Cultural Scope', desc: 'International curious' });
    } else {
        traits.push({ icon: '🇺🇸', label: 'Cultural Scope', desc: 'Hollywood focused' });
    }
    
    // Director taste
    if (analysis.auteurCount >= 2) {
        traits.push({ icon: '🎬', label: 'Director Taste', desc: 'Auteur appreciator' });
    }
    
    // Build summary
    const topGenreNames = topGenres.map(g => g[0]).join(', ');
    summary = `Your favorites center around <strong>${topGenreNames || 'diverse genres'}</strong>`;
    
    if (avgYear < 1990) {
        summary += `, with a clear appreciation for classic cinema`;
    } else if (avgYear > 2010) {
        summary += `, mostly from recent releases`;
    }
    
    if (foreignCount > 0) {
        summary += `. You're open to international films, which shows cultural curiosity`;
    }
    
    summary += '.';
    
    return { summary, traits };
}

// Helper: Get score breakdown factors
// Uses backend score and shows proportional breakdown
function getScoreFactors(analysis, movies, totalScore) {
    const factors = [];
    
    // Get actual values from analysis
    const avgRarity = analysis.avgRarity || 0;
    const genreCount = analysis.genreCount || 0;
    const yearSpread = analysis.yearSpread || 0;
    const auteurCount = analysis.auteurCount || 0;
    
    // Count foreign films from movies array
    const foreignCount = movies.filter(m => m.is_foreign).length;
    const hasPreWar = movies.some(m => m.release_year < 1970);
    const hasModernClassic = movies.some(m => m.release_year >= 2000 && parseFloat(m.rating) >= 8.0);
    
    // Get average rating from movies
    const ratings = movies.map(m => parseFloat(m.rating || 0)).filter(r => r > 0);
    const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
    
    // Calculate raw scores (same as backend)
    // 1. RATING QUALITY (Max 20)
    const ratingScore = Math.round(Math.min(20, Math.max(0, (avgRating - 5) * 5)));
    if (ratingScore > 0) {
        factors.push({ 
            label: 'Film Quality', 
            score: ratingScore, 
            max: 20, 
            desc: `${avgRating.toFixed(1)} avg rating`
        });
    }
    
    // 2. GENRE DIVERSITY (Max 20)
    const genreScore = Math.round(Math.min(20, genreCount * 2.5));
    if (genreScore > 0) {
        factors.push({ 
            label: 'Genre Diversity', 
            score: genreScore, 
            max: 20, 
            desc: `${genreCount} unique genres`
        });
    }
    
    // 3. OBSCURITY/RARITY (Max 20)
    const rarityScore = Math.round(Math.min(20, avgRarity * 0.4));
    if (rarityScore > 0) {
        factors.push({ 
            label: 'Hidden Gems', 
            score: rarityScore, 
            max: 20, 
            desc: `Beyond mainstream picks`
        });
    }
    
    // 4. ERA SPREAD (Max 20)
    const eraScore = Math.round(Math.min(20, yearSpread * 0.25));
    if (eraScore > 0) {
        factors.push({ 
            label: 'Era Range', 
            score: eraScore, 
            max: 20, 
            desc: `${yearSpread} year span`
        });
    }
    
    // 5. CINEPHILE TRAITS (Max 20)
    let traitScore = 0;
    let traitDescs = [];
    
    if (foreignCount > 0) {
        traitScore += 5;
        traitDescs.push(`${foreignCount} foreign`);
    }
    if (hasPreWar) {
        traitScore += 5;
        traitDescs.push('classic era');
    }
    if (auteurCount > 0) {
        const auteurPts = Math.min(5, Math.round(auteurCount * 1.5));
        traitScore += auteurPts;
        traitDescs.push(`${auteurCount} auteur`);
    }
    if (hasModernClassic) {
        traitScore += 5;
        traitDescs.push('modern classic');
    }
    
    traitScore = Math.round(Math.min(20, traitScore));
    if (traitScore > 0) {
        factors.push({ 
            label: 'Cinephile Traits', 
            score: traitScore, 
            max: 20, 
            desc: traitDescs.join(', ')
        });
    }
    
    // Build HTML - show all factors with score > 0
    let html = '<div class="score-breakdown">';
    
    factors.forEach(f => {
        const percentage = (f.score / f.max) * 100;
        html += `
            <div class="score-factor">
                <div class="factor-header">
                    <span class="factor-label">${f.label}</span>
                    <span class="factor-points">+${f.score} pts</span>
                </div>
                <div class="factor-bar">
                    <div class="factor-bar-fill" style="width: ${percentage}%"></div>
                </div>
                <div class="factor-desc">${f.desc}</div>
            </div>
        `;
    });
    
    // Show total using backend score for consistency
    html += `
        <div class="score-total">
            <span>Total Score</span>
            <span class="total-value">${totalScore} / 100</span>
        </div>
    `;
    
    html += '</div>';
    
    return html;
}

// Helper: Get improvement tips based on current level
function getImprovementTips(level, analysis, movies) {
    const tips = [];
    
    const foreignCount = movies.filter(m => m.is_foreign).length;
    const classicCount = movies.filter(m => m.release_year < 1970).length;
    
    if (foreignCount === 0) {
        tips.push('🌍 Add a foreign language film to your Top 4 - try Parasite, Amélie, or Seven Samurai');
    }
    
    if (classicCount === 0) {
        tips.push('📜 Include a pre-1970 classic - consider Casablanca, 12 Angry Men, or Psycho');
    }
    
    if ((analysis.genreCount || 0) < 5) {
        tips.push('🎭 Diversify your genres - your Top 4 has similar genres, try something different');
    }
    
    if ((analysis.yearSpread || 0) < 20) {
        tips.push('📅 Expand your era range - include films from different decades');
    }
    
    if ((analysis.auteurCount || 0) === 0) {
        tips.push('🎬 Explore auteur cinema - directors like Kubrick, Scorsese, Kurosawa, or Villeneuve');
    }
    
    if ((analysis.avgRarity || 0) < 30) {
        tips.push('💎 Discover hidden gems - look beyond the most popular films on Letterboxd');
    }
    
    // Generic tips if none apply
    if (tips.length === 0) {
        tips.push('🎯 Keep exploring diverse cinema to refine your taste');
        tips.push('📝 Watch more films from the Letterboxd top 250 list');
    }
    
    return tips.slice(0, 4); // Max 4 tips
}

function addAnalysisItem(grid, icon, label) {
    const div = document.createElement('div');
    div.className = 'analysis-item';
    div.innerHTML = `
        <div class="analysis-value">${icon}</div>
        <div class="analysis-label">${label}</div>
    `;
    grid.appendChild(div);
}

// Convert numeric rating to Letterboxd-style star display
function getStarDisplay(rating) {
    const fullStars = Math.floor(rating);
    const hasHalf = (rating - fullStars) >= 0.25 && (rating - fullStars) < 0.75;
    const roundUp = (rating - fullStars) >= 0.75;
    
    let stars = '';
    const totalFull = roundUp ? fullStars + 1 : fullStars;
    
    for (let i = 0; i < totalFull && i < 5; i++) {
        stars += '★';
    }
    
    if (hasHalf && totalFull < 5) {
        stars += '½';
    }
    
    // If rating is very low, show at least something
    if (stars === '' && rating > 0) {
        stars = '½';
    }
    
    return stars || '☆';
}

function showError(message) {
    const errorBox = document.getElementById('error');
    errorBox.textContent = message;
    errorBox.classList.remove('hidden');
}

function hideError() {
    document.getElementById('error').classList.add('hidden');
}

// Allow Enter key to submit
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('username');
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            fetchRank();
        }
    });
});
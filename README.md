# 🎬 Top 4 Theory

> Discover your Cinema Level based on your Letterboxd Top 4

A free web tool that analyzes your Letterboxd profile's Top 4 favorite films and calculates a "Cinema Level" score from 1-10, revealing what your movie taste says about you.

🌐 **Live Demo:** [top4theory.vercel.app](https://top4theory.vercel.app)

![Top 4 Theory Screenshot](https://img.shields.io/badge/Status-Live-brightgreen) ![License](https://img.shields.io/badge/License-MIT-blue)

---

## ✨ Features

- **Instant Analysis** - Just enter any Letterboxd username
- **10-Level Ranking System** - From "Casual Viewer" to "Cinema Deity"
- **5-Factor Scoring Algorithm:**
  - 📊 Rating Quality (TMDB scores)
  - 🎭 Genre Diversity
  - 💎 Rarity & Obscurity
  - 📅 Era Diversity (classic to modern)
  - 🎬 Cinephile Traits (auteur recognition, foreign films, etc.)
- **Beautiful UI** - Letterboxd-inspired dark theme
- **No Login Required** - Works with any public Letterboxd profile
- **Shareable Results** - Show off your Cinema Level

---

## 🏆 The 10 Cinema Levels

| Level | Title                   | Description                              |
| ----- | ----------------------- | ---------------------------------------- |
| 1     | The Casual Viewer       | You watch movies to pass the time        |
| 2     | The Popcorn Enthusiast  | You enjoy the movie-going experience     |
| 3     | The Avid Watcher        | You have solid taste and watch regularly |
| 4     | The Eclectic Explorer   | You appreciate variety across genres     |
| 5     | The Dedicated Cinephile | You dig deeper than most viewers         |
| 6     | The Refined Curator     | Your taste is sharp and intentional      |
| 7     | The Cinema Connoisseur  | You have excellent, well-rounded taste   |
| 8     | The Elite Cinephile     | Your picks show deep film appreciation   |
| 9     | The Master Curator      | You see cinema on another level          |
| 10    | The Cinema Deity        | Your taste is legendary. Absolute peak.  |

---

## 🛠️ Tech Stack

- **Backend:** Node.js, Express.js
- **Scraping:** Cheerio
- **Movie Data:** TMDB API
- **Frontend:** Vanilla HTML, CSS, JavaScript
- **Hosting:** Vercel
- **Database:** PostgreSQL (optional caching)

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v16+)
- TMDB API Key ([Get one free](https://www.themoviedb.org/settings/api))

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/siddhraj1412/top4theory.git
   cd top4theory
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env` file in the root directory:

   ```env
   TMDB_API_KEY=your_tmdb_api_key_here
   PORT=3000
   ```

4. **Run the server**

   ```bash
   npm start
   ```

5. **Open in browser**
   ```
   http://localhost:3000
   ```

---

## 📁 Project Structure

```
top4theory/
├── server.js              # Express server entry point
├── package.json
├── .env                   # Environment variables (not in repo)
├── config/
│   ├── db.js              # Database configuration
│   └── schema.sql         # Database schema
├── routes/
│   └── api.js             # API endpoints
├── services/
│   ├── letterboxdScraper.js   # Letterboxd profile scraper
│   └── movieService.js        # TMDB integration & scoring algorithm
└── public/
    ├── index.html         # Main HTML
    ├── style.css          # Letterboxd-inspired styling
    └── script.js          # Frontend logic
```

---

## ⚙️ Scoring Algorithm

The algorithm evaluates Top 4 picks across 5 equally-weighted factors (20 points each, 100 total):

1. **Rating Quality (20 pts)** - Average TMDB rating of your picks
2. **Genre Diversity (20 pts)** - Variety of genres across your Top 4
3. **Rarity Score (20 pts)** - How obscure/underrated your picks are
4. **Era Diversity (20 pts)** - Mix of classic and modern films
5. **Cinephile Traits (20 pts)** - Auteur directors, foreign films, B&W, silent era

**Score to Level Mapping:**

- Level 1: 0-9 pts
- Level 2: 10-19 pts
- Level 3: 20-29 pts
- ...
- Level 10: 90-100 pts

---

## 🌐 Deployment (Vercel)

1. Push code to GitHub
2. Import project to [Vercel](https://vercel.com)
3. Add environment variable:
   - `TMDB_API_KEY` = your API key
4. Deploy!

---

## 🤝 Contributing

Contributions are welcome! Feel free to:

- Report bugs
- Suggest new features
- Submit pull requests

---

## 📜 License

This project is open source under the [MIT License](LICENSE).

---

## 🙏 Acknowledgments

- [Letterboxd](https://letterboxd.com) - The social network for film lovers
- [TMDB](https://www.themoviedb.org) - Movie database API
- Inspired by the Letterboxd community's love for Top 4s

---

## 📬 Contact

**Creator:** [@SiddhrajThakor](https://letterboxd.com/SiddhrajThakor/)

Got feedback? [Send it here](https://forms.gle/2arhuQwDaCs94Rn59)

Like the project? [Buy me a coffee ☕](https://buymeacoffee.com/siddhrajthakor)

---

<p align="center">
  Made with ❤️ for film lovers everywhere
</p>

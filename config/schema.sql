-- CineRank Pro Database Schema
-- Run this script in PostgreSQL to create the required tables

-- Drop existing table if you want a fresh start
-- DROP TABLE IF EXISTS movies;

-- Create movies table with extended fields for ranking
CREATE TABLE IF NOT EXISTS movies (
    id SERIAL PRIMARY KEY,
    tmdb_id INTEGER UNIQUE NOT NULL,
    title VARCHAR(500) NOT NULL,
    release_year INTEGER,
    rating DECIMAL(3,1),
    genres TEXT[],
    vote_count INTEGER DEFAULT 0,
    directors TEXT[],
    countries TEXT[],
    is_foreign BOOLEAN DEFAULT FALSE,
    is_bw BOOLEAN DEFAULT FALSE,
    is_silent BOOLEAN DEFAULT FALSE,
    rarity_score INTEGER DEFAULT 0,
    poster_path VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_movies_tmdb_id ON movies(tmdb_id);
CREATE INDEX IF NOT EXISTS idx_movies_title ON movies(title);
CREATE INDEX IF NOT EXISTS idx_movies_year ON movies(release_year);

-- Example: Check your data
-- SELECT * FROM movies ORDER BY created_at DESC LIMIT 10;

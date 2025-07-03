-- Migration: Install pgvector extension
-- This enables vector data types for embedding storage

CREATE EXTENSION IF NOT EXISTS vector; 
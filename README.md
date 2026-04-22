# Taskboard

A personal task tracking app built with React and Supabase.

## Features
- Magic link authentication (no password)
- Create and manage tasks with status tracking (Open, In Progress, On Hold, Closed)
- Timestamped notes per task
- Search across tasks and notes
- Sort by date created
- Works on any device via Supabase cloud backend

## Setup
1. Create a project at [supabase.com](https://supabase.com)
2. Copy your Project URL and anon key from Settings → API
3. Paste them into `src/App.jsx` at the top of the file
4. Run the SQL schema from the in-app setup screen in your Supabase SQL Editor
5. Add your GitHub Pages URL to Supabase → Authentication → URL Configuration → Redirect URLs

## Development
```bash
npm install
npm run dev
```

## Deploy
Push to `main` — GitHub Actions will build and deploy automatically to GitHub Pages.

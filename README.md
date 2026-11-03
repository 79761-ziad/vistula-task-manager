# Vistula Task Manager

A simple Task Manager built with plain HTML, CSS and JavaScript, hosted on GitHub Pages, with tasks stored in Supabase (PostgreSQL) and accessed through the Supabase REST API.

- **Student ID:** 79761
- **Student Full Name:** Ziad Karoune
- **Live app:** https://79761-ziad.github.io/vistula-task-manager/
- **Repository:** https://github.com/79761-ziad/vistula-task-manager
- **Contributor page:** https://79761-ziad.github.io/vistula-task-manager/contribution.html

## Features

- List all tasks from the database
- Add, edit and delete tasks
- Mark tasks as completed / incomplete
- Changes persist after refreshing the page
- Error messages shown in `#status-message` when an operation fails

## Project structure

| Path | Purpose |
| --- | --- |
| `index.html` | Main Task Manager page |
| `app.js` | Application logic (Supabase REST calls via `fetch`) |
| `style.css` | Styling |
| `config.json` | Public Supabase configuration (URL, publishable key, table name) |
| `supabase/schema.sql` | Database setup: `tasks` table, RLS policies, sample data |
| `contribution.html` / `contribution.json` | Added by my partner through a Pull Request |

## REST API used

Base URL: `https://ewnxyeiwxvhhgmkcwfyy.supabase.co/`

| Method | Endpoint | Used for |
| --- | --- | --- |
| GET | `/tasks?select=*` | Load all tasks |
| GET | `/tasks?id=eq.1&select=*` | Load one task |
| POST | `/tasks` | Create a task |
| PUT | `/tasks?id=eq.1` | Save an edited task (complete record) |
| PATCH | `/tasks?id=eq.1` | Toggle completion status |
| DELETE | `/tasks?id=eq.1` | Delete a task |

## Setup

1. Create a Supabase project and run `supabase/schema.sql` in the SQL Editor.
2. Copy the Project URL and the publishable (anon) key from **Project Settings → API** into `config.json`.
3. Push to GitHub and enable **Settings → Pages → Deploy from branch → `main` / `(root)`**.

Only the public publishable key is stored in this repository. This is a demo database with test data only.

## Team collaboration (Pull Requests)

- PR I received (merged into this repo): _add link here_
- PR I created in my partner's repo: https://github.com/79726-rida/vistula-task-manager/pull/1

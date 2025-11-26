# GearShare - Local Development Quickstart

## Prerequisites

- [Node.js & npm](https://nodejs.org/)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npm install -g supabase`)
- (Optional) Git for cloning the repo

## Setup Instructions

### 1. Clone the Repository

- git clone https://github.com/kwalk523/GearShare.git
- cd GearShare

### 2. Create and Configure Your .env File

- GearShare requires Supabase credentials to run.
- Create a `.env` (or `.env.local`) file in the project root:

NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

- Get these values from your Supabase dashboard, or from the output of `supabase start` if running Supabase locally.

### 3. Install Dependencies

- npm install

### 4. Start the Development Server

- npm run dev

### 5. Troubleshooting

- if you see a blank page, check your `.env` file exists and credentials are correct

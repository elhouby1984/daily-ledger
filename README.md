# Daily Ledger

A free, browser-based personal daily ledger built with Next.js and Supabase.

## Features in this first version

- Email/password account
- Private cloud data using Supabase Row Level Security
- Unlimited categories
- Items inside categories
- Today is the default item date
- Any date can be selected
- Future items automatically receive the "upcoming" visual style
- Future styling disappears automatically when the due date arrives
- Complete/uncomplete items
- Delete items
- Upcoming look-ahead panel
- Responsive desktop/mobile interface

## 1. Create Supabase project

Create a project at https://database.new.

Open SQL Editor and run `supabase/schema.sql`.

Then copy the Project URL and Publishable Key from Supabase's Connect/API area.

## 2. Configure locally

Copy `.env.example` to `.env.local` and fill in:

NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...

## 3. Install and run

Use Node.js 22 LTS or another currently supported LTS release.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## 4. Put it on GitHub

Create an empty repository named `daily-ledger`, then push this project.

## 5. Deploy to Vercel

Import the GitHub repository into Vercel.

Add the same two environment variables in the Vercel project settings.

Deploy.

## Important security note

Never put a Supabase service-role/secret key in this app. The browser app uses the publishable key and relies on Row Level Security so each signed-in user can only access their own categories/items.

## Next upgrades

- Edit categories/items
- Search
- Monthly calendar
- Browser notifications
- PWA install
- Recurring items
- Export/import
- Drag-and-drop ordering
- Dark mode

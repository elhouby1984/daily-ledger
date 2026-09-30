# Daily Ledger

A free, browser-based personal daily ledger built with Next.js and Supabase.

## Upgraded in this version

- Polished modern dashboard UI
- Live clock next to the selected date
- Today / completed / due-now summary
- Due date + due time for every item
- Due-soon and overdue visual states
- Browser notification permission and due-time alerts
- In-app due notification toast
- Notification de-duplication per browser/device
- PWA manifest for installable browser experience
- Responsive desktop/tablet/mobile layout
- Supabase cloud storage and Row Level Security

## Notification behavior

The browser notification feature checks due items while the Daily Ledger page is open. The user must click **Enable alerts** once and allow browser notifications.

A true notification while the browser is completely closed requires Web Push (VAPID keys + a server-side push endpoint). The current version intentionally does not pretend a normal browser timer can wake a closed browser.

## Setup

1. Create a Supabase project at https://database.new.
2. Run `supabase/schema.sql` in Supabase SQL Editor.
   - It includes a safe migration for the new `due_time` field.
3. Copy `.env.example` to `.env.local` and add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
4. Run:
   `npm install`
   `npm run dev`
5. Deploy to Vercel and add the same environment variables.

Never put a Supabase service-role/secret key in the browser app.

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Enprotec Workflow Management System

This contains everything you need to run the application locally.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create an `.env.local` file with:
   - `GEMINI_API_KEY`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
     - Required for migration and local API emulation (`/api/create-user`)
3. Run the app:
   `npm run dev`

## Reset Password Flow

- On the sign-in screen, select “Forgot your password?” and submit the email associated with your account. We verify the profile via Supabase and send a password-recovery email if the account exists.
- The Supabase project should allow password recovery emails and set the site URL to include `/reset-password`.
- Clicking the link in the email opens `/reset-password`, where the user can set a new password and is directed back to sign in once complete.

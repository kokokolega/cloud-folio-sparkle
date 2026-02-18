
# Fylix — Premium Cloud File Manager

## Overview
A premium, Apple-inspired cloud file manager that lets users upload images and PDFs, organize them in folders, generate shareable/embeddable links, and manage files with a polished glassmorphism UI. Built with React + Supabase (auth, database, storage).

---

## Phase 1: Foundation & Design System
- Set up custom color palette (soft gray gradients, glassmorphism tokens, accent blue/indigo)
- Configure dark mode support (#0f0f0f background, #1a1a1a cards)
- Define reusable glassmorphism card component with backdrop-blur-xl, soft shadows, 16-24px rounded corners
- Add smooth transition/animation utilities (scale-on-hover, fade-in, shimmer loading)
- Create the Fylix logo/branding in the sidebar

## Phase 2: Authentication
- Email + password signup and login pages with premium styling
- Password reset flow
- Protected routes — unauthenticated users redirected to login
- Supabase Auth integration

## Phase 3: Database & Storage Setup
- **Supabase tables:**
  - `profiles` (id, email, created_at)
  - `folders` (id, user_id, name, parent_id, created_at)
  - `files` (id, user_id, folder_id, name, type, size, storage_path, public_id, created_at, deleted_at)
- **Storage bucket:** `user-files` (public, with RLS so only owners can upload/manage)
- **RLS policies:** Users can only access their own files and folders
- Auto-create profile on signup via trigger

## Phase 4: App Layout
- **Left Sidebar** (fixed, collapsible on mobile): Fylix logo, nav items — All Files, Images, PDFs, Folders, Trash, Settings. Minimal icons, active route highlighting, smooth collapse animation
- **Top Bar:** Centered search input, prominent Upload button (glowing accent), profile avatar with dropdown (settings, logout)
- **Main Content Area:** Grid view of file/folder cards, responsive columns (2 mobile, 3 tablet, 4-6 desktop)

## Phase 5: File Upload System
- Drag-and-drop upload zone with visual feedback
- Accept only JPG, PNG, WEBP, PDF (10MB limit per file)
- Upload progress bar with smooth animation
- Success checkmark animation on completion
- Client-side file type/size validation with error messages
- Auto-refresh file grid after upload

## Phase 6: File Management
- **File cards** with: thumbnail preview (images) or PDF icon, file name, size, date, three-dot menu
- **Actions:** Rename, delete (move to trash), move to folder, copy public link
- **Hover effects:** Slight scale (1.02), quick action overlay
- Sort by: newest, oldest, size, alphabetical
- Search by file name with instant filtering
- Filter by type (Images / PDFs)

## Phase 7: Folder System
- Create, rename, delete folders
- Move files between folders via menu action
- Nested folder navigation with breadcrumb trail
- Folder cards with clean icons and smooth open animation

## Phase 8: Trash System
- Soft-delete: deleted files get a `deleted_at` timestamp
- Trash view showing deleted files
- Restore to original location
- Permanent delete option

## Phase 9: Public Links & Embed System
- Each file gets a unique public ID on upload
- **Public file page** (`/file/:publicId`): Preview image or PDF, download button
- **Embed route** (`/embed/:publicId`): Renders `<img>` for images or `<iframe>` for PDFs
- Copy-to-clipboard buttons for: public link, direct embed link, HTML embed code snippet
- These routes are public (no auth required), read-only

## Phase 10: Responsive & Polish
- Mobile: collapsible sidebar (hamburger), 2-column grid, floating upload button
- Tablet: 3-column grid
- Desktop: 4-6 column grid with full sidebar
- Smooth page transitions, loading shimmers, premium micro-interactions throughout
- Dark/light mode toggle

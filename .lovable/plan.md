

## Assignment Tracking & Collaboration App — Full Build Plan

### Theme & Design System
- **Primary:** Orange (`#F97316`) + Blue (`#3B82F6`) color palette
- **Light/Dark mode toggle** in sidebar header
- Sidebar navigation with icons, presence indicators, and collapse support
- Responsive layout (desktop, tablet, mobile)
- Modern, student-friendly UI using shadcn/ui components

---

### Database Schema (Supabase Postgres)

**Core Tables:**
- `profiles` — user_id (FK auth.users), full_name, avatar_url, university, major, grad_year, study_interests, canvas_access_token (encrypted), help_points, study_streaks
- `user_roles` — user_id, role (enum: admin, user)
- `courses` — id, canvas_course_id, name, code, description, color
- `user_courses` — user_id, course_id (junction)
- `assignments` — id, course_id, canvas_assignment_id, title, description, due_date, status (pending/in-progress/completed/missed), assignment_type
- `user_assignments` — user_id, assignment_id, status, completed_at
- `user_events` — id, user_id, title, start_time, end_time, is_recurring, recurrence_rule, event_type (lecture/lab/office_hours/personal), course_id, is_canvas_synced
- `task_attachments` — id, assignment_id, user_id, file_url, file_name

**Chat Tables:**
- `chatrooms` — id, name, type (dm/group/assignment_thread), course_id, assignment_id, created_by
- `chatroom_members` — chatroom_id, user_id, joined_at
- `messages` — id, chatroom_id, user_id, content, sent_at, edited_at
- `friendships` — id, requester_id, addressee_id, status (pending/accepted/blocked)

**Whiteboard Tables:**
- `whiteboards` — id, name, created_by, course_id, max_users (default 5)
- `whiteboard_members` — whiteboard_id, user_id
- `whiteboard_notes` — id, whiteboard_id, user_id, content, position_x, position_y, color, updated_at

**Stats (derived from existing data, no extra tables needed)**

All tables get RLS policies scoped to authenticated users. Realtime enabled on messages, whiteboard_notes, chatroom_members.

---

### Pages & Features

#### 1. Auth (Login/Signup)
- Email + password signup/login via Supabase Auth
- Canvas access token input field during onboarding (stored encrypted in profile)
- "Validate & Continue" flow that tests the token against Canvas API
- Password reset flow

#### 2. Dashboard (Home)
- Customizable widget grid (drag-and-drop reorder via `dnd-kit`)
- Widgets: 7-day deadline preview, to-do list, mini calendar, productivity stats, reminders
- Widget preferences persisted in `profiles.dashboard_config` (JSONB)
- Progress bars per assignment and per course

#### 3. Assignment & Task Manager
- Canvas sync: Edge function fetches assignments/courses from Canvas API using stored token
- Manual task creation form (title, due date, course, description, attachments)
- File upload to Supabase Storage bucket
- Status management: pending → in-progress → completed / missed
- Filters by course, status, due date
- Due date reminders (in-app notification toast system)

#### 4. Unified Calendar
- Full calendar with day/week/month views (using a React calendar library)
- Color-coded events by course and type
- Overlay of Canvas assignments + class schedule + personal tasks
- Add/edit/delete events with recurrence support
- AI study timing suggestions shown as highlighted blocks (rule-based: find free slots before deadlines)

#### 5. Chat & Messaging
- Sidebar contact list with online/offline/away presence (Supabase Realtime presence)
- Direct messages (1:1)
- Group chats (course-linked or custom)
- Assignment-linked discussion threads
- Real-time message delivery via Supabase Realtime subscriptions
- Friend request system (send/accept/decline)
- Shared courses visible on contact profiles

#### 6. Whiteboard (Simple Shared Notes)
- Create whiteboard sessions, invite friends (max 5 users)
- Real-time collaborative sticky notes board
- Each note: draggable, editable text, color-coded
- Synced via Supabase Realtime on `whiteboard_notes` table
- Session state persisted automatically

#### 7. Profile & Settings
- View/edit name, avatar, university, major, grad year, study interests
- Canvas access token management
- Theme toggle (light/dark)
- Notification preferences

#### 8. Statistics & Productivity
- Charts via Recharts: assignments completed vs missed over time, completion rate by course, streaks
- Time-to-completion trends
- Group contribution tracking (who completed what in shared assignments)
- Bar, pie, and line chart visualizations

---

### Canvas API Integration
- Edge function: `canvas-sync` — authenticates with user's Canvas token, fetches courses, assignments, due dates
- Data mapped to Supabase tables (courses, assignments, user_courses, user_assignments)
- Manual sync trigger button + option for periodic sync
- OAuth 2.0 flow handled via Canvas access token validation

---

### Navigation Structure
- **Sidebar** (collapsible): Dashboard, Calendar, Assignments, Chat, Whiteboard, Stats, Profile
- Each nav item has an icon + label
- Presence indicator dots on Chat nav item
- Dark/light mode toggle in sidebar footer

---

### Implementation Order (all scaffolded in first pass)
1. Design system (orange/blue theme, light/dark mode CSS variables)
2. Supabase schema migration (all tables + RLS)
3. Auth pages (login, signup, password reset)
4. App layout with sidebar navigation
5. Dashboard with widget grid
6. Assignment manager + Canvas sync edge function
7. Calendar page
8. Chat system with Realtime
9. Whiteboard (shared notes)
10. Statistics dashboard
11. Profile/Settings page


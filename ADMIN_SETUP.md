# Admin Portal Setup Guide

## 🎉 What We Built

A complete admin dashboard system for Zineground that allows you to:
- View platform statistics (users, issues, distributors, QR scans)
- Manage distributor applications (approve/reject)
- Protected admin-only routes with role-based access control

## 📁 Files Created

### Core Admin Utilities
- `/src/lib/admin.ts` - Server-side admin role checking functions
- `/src/lib/useAdmin.ts` - Client-side React hook for admin status

### API Endpoints
- `/src/app/api/admin/check/route.ts` - Check if user is admin
- `/src/app/api/admin/stats/route.ts` - Platform statistics
- `/src/app/api/admin/distributors/route.ts` - List all distributors
- `/src/app/api/admin/distributors/[id]/route.ts` - Update distributor status

### Admin Pages
- `/src/app/dashboard/admin/page.tsx` - Admin dashboard home
- `/src/app/dashboard/admin/distributors/page.tsx` - Distributor management

### Modified Files
- `/src/middleware.ts` - Added admin route protection
- `/src/app/dashboard/page.tsx` - Added admin tile (conditionally visible)

## 🚀 Setup Instructions

### Step 1: Create Admin Account and Update Role in Supabase

1. **Sign up** with `hello@zineground.com` in your production app
2. The Clerk webhook will automatically create a profile in Supabase
3. Go to your **Supabase Dashboard**
4. Navigate to **Table Editor** → **profiles**
5. Find the row where `email = 'hello@zineground.com'`
6. Edit the `role` column
7. Change from `'creator'` to `'admin'`
8. Save

### Step 2: Test the Admin Portal

1. Sign in to your Zineground account with `kairosglobalapp@gmail.com`
2. Go to `/dashboard`
3. You should see a purple **Admin Dashboard** tile (5th tile)
4. Click it to access the admin portal

### Step 3: Managing Distributors

**Admin Dashboard**: `/dashboard/admin`
- View platform stats
- Quick access to distributor management

**Distributor Management**: `/dashboard/admin/distributors`
- Three tabs: Pending, Approved, Rejected
- View full distributor details
- Approve or reject applications with one click

## 🔒 Security Features

✅ **Middleware Protection**: Non-admin users are redirected to `/dashboard`  
✅ **API Authorization**: All admin API endpoints verify admin role  
✅ **Role-Based Access**: Uses Supabase `profiles.role` field  
✅ **Double-Check**: Both middleware and API endpoints verify admin status

## 🎯 User Flow: Distributor Application

### Regular User Perspective
1. User visits `/dashboard/distributor`
2. Fills out registration form
3. Application saved to `distributors` table with `status: 'pending'`
4. User sees "Registration Pending" message
5. Once approved by admin, user gains access to distributor portal

### Admin Perspective
1. Admin visits `/dashboard/admin/distributors`
2. Sees pending applications
3. Clicks "View Details" to review full application
4. Clicks "Approve" or "Reject"
5. Distributor status updated in database
6. User can now access distributor portal (if approved)

## 📊 Admin Dashboard Features

### Stats Cards
- Total Users
- Published Issues
- QR Code Scans
- **Pending Distributors** (highlighted)
- Approved Distributors
- Total Distributors

### Quick Actions
- ✅ Manage Distributors (active)
- 🚧 Manage Users (coming soon)
- 🚧 Content Moderation (coming soon)
- 🚧 Platform Analytics (coming soon)

## 🛠️ Future Enhancements

Ideas for expansion:
- Email notifications when distributor is approved/rejected
- Admin notes/comments on applications
- Bulk actions (approve/reject multiple)
- User management (ban, change roles)
- Content moderation for published issues
- Advanced analytics dashboard

## 💡 Troubleshooting

**Admin tile not showing?**
- Verify your role is set to `'admin'` in Supabase profiles table
- Clear browser cache and refresh
- Check browser console for errors

**Getting redirected from admin pages?**
- Ensure you're signed in with the admin email
- Verify middleware is running (check terminal logs)
- Confirm Supabase environment variables are set

**Distributors not loading?**
- Check browser console for API errors
- Verify Supabase permissions allow reading `distributors` table
- Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in `.env.local`

## 📝 Database Schema

The admin portal relies on these tables:

### `profiles`
- `clerk_id` (text, unique)
- `email` (text)
- `role` (text) - **Set to 'admin' for admin users**

### `distributors`
- `id` (uuid, primary key)
- `user_id` (text, references Clerk user)
- `status` (text) - 'pending' | 'approved' | 'rejected'
- `business_name`, `business_address`, `business_phone`, `business_email`
- `contact_name`, `contact_title`, `contact_email`, `contact_phone`
- `created_at`, `updated_at`

---

**Built for Zineground** 🎨


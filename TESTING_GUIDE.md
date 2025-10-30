# ZineMat Testing Guide

## 🚀 Quick Start Testing

This guide will help you test all the new ZineMat features that were just implemented.

---

## Prerequisites

1. Make sure you're logged in to Zineground
2. Have a test image file ready (for cover)
3. Have a test PDF file ready (for zine content)
4. Optional: Have a QR code scanner app on your phone

---

## Test 1: Create a New Zine (Draft)

### Steps:
1. Navigate to `/zinemat`
2. Enter a title (e.g., "Test Zine 1")
3. Click **"Save Draft"**
4. You should see a success toast: "Draft saved!"
5. You'll be redirected to `/dashboard`

### Expected Result:
- ✅ Draft is saved
- ✅ No date field in the Basics section (only title)
- ✅ Can save with just a title

---

## Test 2: Add Uploads to Draft

### Steps:
1. Go to `/dashboard/library`
2. Find your "Test Zine 1" in the Drafts section
3. Click **"Edit"**
4. In the Toolkit section, click **"Add"** on "B) Uploads"
5. Upload a cover image
6. Upload a PDF
7. Click **"Save Changes"**

### Expected Result:
- ✅ Files upload successfully
- ✅ You see "Changes saved!" toast
- ✅ Files are visible when you edit again

---

## Test 3: Add Interactive Links & QR Codes

### Steps:
1. While editing your zine, add the "C) Interactivity" section
2. Add a link:
   - Label: "Link 1"
   - URL: "https://google.com"
   - Keep "QR" checkbox checked
3. Click **"Add"**
4. Add another link:
   - Label: "Instagram"
   - URL: "https://instagram.com/yourhandle"
   - Keep "QR" checked
5. Click **"Add"**
6. Scroll down to see the QR codes
7. Click **"Download QR"** on one of them

### Expected Result:
- ✅ Links appear in the list
- ✅ QR codes generate and display in a grid
- ✅ Download button works and saves PNG file
- ✅ QR code filename matches the link label

---

## Test 4: QR Code Redirect System

### Steps:
1. Open the downloaded QR code PNG
2. Scan it with your phone's camera or a QR code app
3. It should redirect you through a URL like:
   ```
   https://zineground.com/qr/[some-uuid]/[another-uuid]
   ```
4. You should then be redirected to the actual URL (e.g., google.com)

### Expected Result:
- ✅ QR code scans successfully
- ✅ Redirects through tracking URL
- ✅ Ends up at correct destination
- ✅ Scan is logged in database (check `qr_scans` table in Supabase)

---

## Test 5: Edit Link URL (QR Persistence Test)

### Steps:
1. Go back to edit your zine
2. Find the "Link 1" you created
3. Click **"Remove"** to delete it
4. Add a new link:
   - Label: "Link 1"
   - URL: "https://github.com" (different URL!)
   - Keep "QR" checked
5. Click **"Save Changes"**
6. Download the NEW QR code for "Link 1"
7. Scan it with your phone

### Expected Result:
- ✅ New QR code is generated
- ✅ Scanning the new QR code redirects to github.com
- ✅ Old QR code (if you kept it) no longer works (404)

**Note:** This test demonstrates that link IDs are regenerated when you remove and re-add. In a real workflow, you'd edit the URL directly in the database or keep the link and just change the URL field (future feature).

---

## Test 6: Publish the Zine

### Steps:
1. Make sure your zine has:
   - ✅ A title
   - ✅ A cover image
2. Click **"Publish"**
3. You should see "Published successfully!"
4. Navigate to `/dashboard/library`
5. Your zine should now be in the "Published" section

### Expected Result:
- ✅ Zine moves from Draft to Published
- ✅ `published_at` timestamp is set in database
- ✅ "View" button appears
- ✅ Can still "Edit" published zines

---

## Test 7: View Published Zine

### Steps:
1. In Library, find your published zine
2. Note the published date displayed
3. Click **"View"**
4. You should see the zine's public page at `/issues/test-zine-1`

### Expected Result:
- ✅ Public page displays correctly
- ✅ Cover image shows
- ✅ Title displays
- ✅ PDF is accessible (if displayed on public page)
- ✅ Published date is shown

---

## Test 8: Edit Published Zine

### Steps:
1. From Library, click **"Edit"** on your published zine
2. Change the title to "Test Zine 1 (Updated)"
3. Add a third link with a QR code
4. Click **"Save Changes"**
5. Go back to Library

### Expected Result:
- ✅ Changes are saved
- ✅ `published_at` timestamp is NOT changed (check database)
- ✅ New link and QR code are available
- ✅ Zine still shows as "Published"

---

## Test 9: Multiple Zines

### Steps:
1. Go to `/zinemat` (create new)
2. Create "Test Zine 2" with different content
3. Save as draft
4. Go to Library
5. Verify both zines appear

### Expected Result:
- ✅ Multiple zines can be created
- ✅ Both show in Library
- ✅ Can edit each independently
- ✅ Each has unique issue ID and slug

---

## Test 10: Maximum Links (Edge Case)

### Steps:
1. Edit any zine
2. Try to add 9 links (maximum is 8)
3. After adding 8, the form should prevent more

### Expected Result:
- ✅ Can add up to 8 links
- ✅ "Add" button is disabled after 8
- ✅ Warning message shows: "Maximum 8 links reached"

---

## 🐛 Common Issues & Solutions

### Issue: "Save Draft" doesn't work
- **Solution:** Make sure you've entered a title (required field)

### Issue: Can't add links
- **Solution:** You must save the draft first. You'll see an overlay with a message.

### Issue: QR code doesn't scan
- **Solution:** 
  - Ensure the QR code image is clear and not too small
  - Try a different QR scanning app
  - Check that `NEXT_PUBLIC_SITE_URL` is set correctly in `.env`

### Issue: "Publish" button is disabled
- **Solution:** You need both a title AND a cover image to publish

### Issue: Cover/PDF doesn't show when editing
- **Solution:** 
  - Check Supabase storage bucket permissions
  - Verify the files uploaded successfully
  - Check browser console for CORS errors

---

## 🗄️ Database Checks

After testing, you can verify data in Supabase:

### Check `issues` table:
```sql
SELECT id, title, slug, status, published_at, profile_id 
FROM issues 
ORDER BY created_at DESC;
```

### Check `issue_links` table:
```sql
SELECT l.id, l.issue_id, l.label, l.url, l.redirect_path, i.title
FROM issue_links l
JOIN issues i ON l.issue_id = i.id
ORDER BY l.created_at DESC;
```

### Check `qr_scans` table:
```sql
SELECT qs.*, il.label, i.title
FROM qr_scans qs
JOIN issue_links il ON qs.link_id = il.id
JOIN issues i ON qs.issue_id = i.id
ORDER BY qs.scanned_at DESC;
```

---

## 📊 Analytics Verification

If PostHog is configured, check for these events:
- Event name: `qr_scan`
- Properties should include:
  - `issue_id`
  - `link_id`
  - `label`
  - `user_agent`
  - `referer`

---

## ✅ Testing Checklist

Use this checklist to track your testing progress:

- [ ] Can create new draft with just title
- [ ] Can upload cover and PDF
- [ ] Can add up to 8 links
- [ ] QR codes generate correctly
- [ ] QR codes can be downloaded
- [ ] QR codes scan and redirect properly
- [ ] Scans are logged in database
- [ ] Can edit existing drafts
- [ ] Existing files show when editing
- [ ] Can publish with title + cover
- [ ] Published zines show in Library
- [ ] `published_at` is set correctly
- [ ] Can edit published zines
- [ ] `published_at` doesn't change on edit
- [ ] Multiple zines can be managed
- [ ] Public view works for published zines
- [ ] All buttons (Save/Publish/Edit) work correctly

---

## 🎯 Success Criteria

Your testing is successful if:
1. ✅ All features in the checklist work
2. ✅ No console errors in browser
3. ✅ No 500 errors from API
4. ✅ Data is correctly stored in Supabase
5. ✅ QR tracking works end-to-end
6. ✅ UI is responsive and intuitive

---

## 📝 Reporting Issues

If you find any bugs, please note:
1. What you were doing (step-by-step)
2. What you expected to happen
3. What actually happened
4. Browser console errors (if any)
5. Network tab errors (if any)
6. Screenshots (if applicable)

---

**Happy Testing! 🎉**

If everything works, you're ready to use the ZineMat in production!


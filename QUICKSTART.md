# QUICK START GUIDE

## 🚀 Get Started in 5 Minutes

### Prerequisites
- Node.js 16+ installed
- PostgreSQL 12+ installed
- Modern web browser

### Step 1: Clone & Install (2 minutes)

```bash
# Clone or download the project
cd lambert-inspection-platform

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Step 2: Setup Database (1 minute)

```bash
# Create database
createdb lambert_inspection

# Or using psql:
psql -U postgres
CREATE DATABASE lambert_inspection;
\q
```

### Step 3: Configure Environment (1 minute)

**Backend:**
```bash
cd backend
cp .env.example .env

# Edit .env:
# DATABASE_URL=postgresql://your_user:your_password@localhost:5432/lambert_inspection
# JWT_SECRET=change-this-to-something-secure
```

**Frontend:**
```bash
cd frontend
cp .env.example .env

# Default settings work for local development
# REACT_APP_API_URL=http://localhost:5000/api
```

### Step 4: Initialize & Start (1 minute)

**Terminal 1 - Backend:**
```bash
cd backend
npm run init-db  # Creates tables and default admin
npm start        # Starts on http://localhost:5000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start        # Starts on http://localhost:3000
```

### Step 5: Login & Test

1. Open browser to `http://localhost:3000`
2. Login with:
   - Email: `admin@lambertelectromec.com`
   - Password: `Admin@123`
3. You're in! 🎉

## 📱 Quick Feature Tour

### As Admin

1. **Create a User**
   - Click "Users" → "Add User"
   - Fill in details
   - Assign role: Inspector
   - Save

2. **Create a Form Template**
   - Click "Forms" → "New Form"
   - Add form title: "Safety Inspection"
   - Select category: "QHSE"
   - Add fields:
     - Text: "Inspector Name"
     - Select: "Status" (Options: Pass, Fail, N/A)
     - Textarea: "Observations"
     - Checkbox: "PPE Worn"
   - Save

3. **Logout and login as Inspector**

### As Inspector

1. **Create an Inspection**
   - Click "New Inspection"
   - Select form: "Safety Inspection"
   - Fill in location and equipment ID
   - Fill out form fields
   - Click "Take Photo" → Allow camera → Capture
   - Add notes
   - Click "Submit Inspection"

2. **Test Offline Mode**
   - Open DevTools (F12)
   - Go to Network tab
   - Check "Offline"
   - Create another inspection
   - Notice "Offline" indicator
   - Uncheck "Offline"
   - Click "Sync" button
   - Your offline inspection is now online!

### As Supervisor

1. **Review Inspections**
   - View submitted inspections
   - Click on an inspection
   - Review details and photos
   - Click "Approve" or "Reject"
   - Add comments
   - Submit review

## 🎯 Common Tasks

### Add a New Field Type to Form

```javascript
// In FormBuilder.js, add to field type dropdown:
<option value="time">Time</option>

// In InspectionForm.js, add rendering:
case 'time':
  return (
    <input
      type="time"
      value={formData[field.id] || ''}
      onChange={(e) => handleFieldChange(field.id, e.target.value)}
      required={field.required}
      className="form-control"
    />
  );
```

### Change Photo Limit

```javascript
// In InspectionForm.js:
// Line ~40 - Change from 5 to your desired number
if (photos.length >= 10) {  // Changed from 5 to 10
  setError('Maximum 10 photos allowed per inspection');
  return;
}
```

### Add New User Role

```sql
-- In initDatabase.js, update CHECK constraint:
role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'supervisor', 'inspector', 'manager'))

-- Then update role checks in routes and components
```

### Change Primary Color

```css
/* In App.css, change :root variables: */
:root {
  --primary: #059669;  /* Changed to green */
  --primary-dark: #047857;
}
```

## 🐛 Troubleshooting

### "Database connection failed"
```bash
# Check PostgreSQL is running:
sudo service postgresql status

# Check your DATABASE_URL in backend/.env
# Format: postgresql://username:password@localhost:5432/lambert_inspection
```

### "Port 5000 already in use"
```bash
# Kill process on port 5000:
lsof -ti:5000 | xargs kill -9

# Or change port in backend/.env:
PORT=5001
```

### "Camera not working"
- Camera only works on localhost or HTTPS
- Check browser permissions
- Try Chrome if using Firefox

### Frontend shows "Network Error"
- Check backend is running on port 5000
- Verify REACT_APP_API_URL in frontend/.env
- Check CORS settings in backend

### "npm install" fails
```bash
# Clear cache and try again:
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

## 📚 Next Steps

1. **Read Full Documentation**
   - See README.md for complete features
   - See DEPLOYMENT.md for production setup

2. **Customize for Your Needs**
   - Update branding and colors
   - Create your form templates
   - Configure user roles

3. **Deploy to Production**
   - Follow DEPLOYMENT.md guide
   - Recommended: Railway + Vercel (free)

4. **Add More Features**
   - Export to PDF
   - Email notifications
   - Advanced reporting
   - Barcode/QR scanning

## 💡 Tips

- **Offline first**: Always design workflows assuming users might be offline
- **Test offline**: Regularly test offline functionality during development
- **Photo size**: Large photos can slow sync; consider compression
- **Form design**: Keep forms simple and mobile-friendly
- **Regular backups**: Set up automatic database backups

## 🆘 Getting Help

- Check browser console (F12) for errors
- Review backend logs for API errors
- Test API endpoints with Postman
- Check database for data issues

## 🎓 Learning Resources

- **React**: https://react.dev
- **Express**: https://expressjs.com
- **PostgreSQL**: https://www.postgresql.org/docs/
- **IndexedDB**: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- **PWA**: https://web.dev/progressive-web-apps/

---

**Congratulations!** 🎉 You now have a fully functional inspection platform. Start creating forms and conducting inspections!

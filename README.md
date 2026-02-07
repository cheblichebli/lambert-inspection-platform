# Lambert Electromec Inspection Platform

A comprehensive mobile-first inspection platform for QA/QC, QHSE, Equipment Installation, and Maintenance management with **offline-first capability**, photo capture, and real-time sync.

## 🚀 Features

### Core Functionality
- ✅ **Offline-First Operation** - Works without internet using IndexedDB
- 📸 **Photo Capture** - Camera integration with 5 photos per inspection
- 📋 **Dynamic Form Builder** - Drag-and-drop form creation with multiple field types
- 🔄 **Automatic Sync** - Background sync when internet connection is restored
- 👥 **Role-Based Access** - Inspector, Supervisor, and Admin roles
- ✔️ **Approval Workflow** - Submit → Review → Approve/Reject workflow
- 📱 **Mobile-Optimized** - Progressive Web App (PWA) for smartphone use
- 🔐 **Secure Authentication** - JWT-based authentication system

### User Roles

1. **Inspector**
   - Create and submit inspections
   - Capture photos (max 5 per inspection)
   - Work offline, sync when online
   - View own inspections

2. **Supervisor**
   - Review submitted inspections
   - Approve or reject with comments
   - View all inspections
   - Access form templates

3. **Admin**
   - Full system access
   - Create/edit form templates
   - User management
   - System configuration

### Form Field Types
- Text input
- Number input
- Text area
- Dropdown (select)
- Checkbox
- Radio buttons
- Date picker

## 📋 Prerequisites

- **Node.js** 16+ and npm
- **PostgreSQL** 12+
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Camera-enabled device for photo capture

## 🛠️ Installation & Setup

### 1. Database Setup

```bash
# Create PostgreSQL database
createdb lambert_inspection

# Or using psql
psql -U postgres
CREATE DATABASE lambert_inspection;
\q
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env with your database credentials
# DATABASE_URL=postgresql://username:password@localhost:5432/lambert_inspection
# JWT_SECRET=your-secure-secret-key-here

# Initialize database (creates tables and default admin)
npm run init-db

# Start backend server
npm start
# Or for development with auto-reload:
npm run dev
```

The backend will run on `http://localhost:5000`

**Default Admin Credentials:**
- Email: `admin@lambertelectromec.com`
- Password: `Admin@123`

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env if needed (default is correct for local development)
# REACT_APP_API_URL=http://localhost:5000/api

# Start frontend development server
npm start
```

The frontend will run on `http://localhost:3000`

## 📱 Usage Guide

### Getting Started

1. **Login** with default admin credentials
2. **Create Users** (Admin only)
   - Navigate to Users → Add User
   - Assign appropriate roles

3. **Create Form Templates** (Admin only)
   - Navigate to Forms → New Form
   - Add fields with drag-and-drop builder
   - Set field types and validation rules
   - Save template

4. **Conduct Inspections** (Inspector)
   - Navigate to Inspections → New Inspection
   - Select form template
   - Fill in required fields
   - Capture photos (up to 5)
   - Save as draft or submit

5. **Review Inspections** (Supervisor/Admin)
   - Navigate to Dashboard or Inspections
   - Click on submitted inspection
   - Review details and photos
   - Approve or reject with comments

### Working Offline

**Before Going Offline:**
1. Login while online
2. The app automatically downloads:
   - Active form templates
   - Your pending inspections
   - User data

**While Offline:**
1. Create new inspections
2. Capture photos
3. Save as draft or submit
4. All data stored locally in browser

**When Back Online:**
1. App detects internet connection
2. Click "Sync" button or it syncs automatically
3. All offline inspections uploaded to server
4. Latest data downloaded

## 🏗️ Project Structure

```
lambert-inspection-platform/
├── backend/
│   ├── routes/
│   │   ├── auth.js          # Authentication endpoints
│   │   ├── users.js         # User management
│   │   ├── forms.js         # Form templates
│   │   ├── inspections.js   # Inspection CRUD
│   │   └── sync.js          # Offline sync
│   ├── middleware/
│   │   └── auth.js          # JWT authentication
│   ├── scripts/
│   │   └── initDatabase.js  # Database initialization
│   ├── server.js            # Express server
│   ├── package.json
│   └── .env.example
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Login.js
    │   │   ├── Dashboard.js
    │   │   ├── Navigation.js
    │   │   ├── SyncStatus.js
    │   │   ├── InspectionForm.js
    │   │   ├── InspectionList.js
    │   │   ├── InspectionDetail.js
    │   │   ├── FormBuilder.js
    │   │   ├── FormList.js
    │   │   └── UserManagement.js
    │   ├── db.js             # IndexedDB configuration
    │   ├── api.js            # API client with offline support
    │   ├── App.js            # Main app component
    │   ├── App.css           # Styling
    │   └── index.js
    ├── public/
    ├── package.json
    └── .env.example
```

## 🔒 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Role-based authorization
- SQL injection prevention
- XSS protection with Helmet.js
- CORS configuration
- Secure HTTP headers

## 📊 Database Schema

### Tables

**users**
- Authentication and role management
- Roles: admin, supervisor, inspector

**form_templates**
- Dynamic form definitions
- Categories: QA/QC, QHSE, Equipment Installation, Maintenance
- JSON field storage for flexibility

**inspections**
- Inspection records with JSON data
- Status workflow: draft → submitted → approved/rejected
- Offline sync support with UUID

**inspection_photos**
- Base64 photo storage
- Linked to inspections
- Sequence ordering

**sync_logs**
- Sync activity tracking
- Error logging

## 🌐 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/change-password` - Change password

### Users
- `GET /api/users` - List all users (Admin/Supervisor)
- `POST /api/users` - Create user (Admin)
- `PUT /api/users/:id` - Update user (Admin)
- `GET /api/users/me` - Get current user profile

### Forms
- `GET /api/forms` - List form templates
- `GET /api/forms/:id` - Get form template
- `POST /api/forms` - Create form template (Admin)
- `PUT /api/forms/:id` - Update form template (Admin)
- `DELETE /api/forms/:id` - Delete form template (Admin)

### Inspections
- `GET /api/inspections` - List inspections (filtered by role)
- `GET /api/inspections/:id` - Get inspection details
- `POST /api/inspections` - Create inspection
- `PUT /api/inspections/:id` - Update inspection
- `POST /api/inspections/:id/review` - Review inspection (Supervisor/Admin)
- `DELETE /api/inspections/:id` - Delete inspection
- `GET /api/inspections/stats/summary` - Get statistics (Supervisor/Admin)

### Sync
- `POST /api/sync/inspections` - Sync offline inspections
- `GET /api/sync/download` - Download data for offline use
- `GET /api/sync/history` - Get sync history

## 🔧 Configuration

### Environment Variables

**Backend (.env)**
```
DATABASE_URL=postgresql://username:password@localhost:5432/lambert_inspection
JWT_SECRET=your-secret-key-change-in-production
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

**Frontend (.env)**
```
REACT_APP_API_URL=http://localhost:5000/api
```

## 🚀 Deployment

### Backend Deployment (e.g., Heroku, Railway, Render)

1. Set environment variables in hosting platform
2. Connect PostgreSQL database
3. Deploy backend code
4. Run database initialization: `npm run init-db`

### Frontend Deployment (e.g., Vercel, Netlify)

1. Build production bundle: `npm run build`
2. Set `REACT_APP_API_URL` to your backend URL
3. Deploy build folder
4. Configure PWA settings for offline support

### Recommended Hosting

**Backend:**
- Railway.app (free tier with PostgreSQL)
- Render.com (free tier)
- Heroku (with PostgreSQL addon)

**Frontend:**
- Vercel (free tier, excellent PWA support)
- Netlify (free tier)
- Cloudflare Pages

## 📸 Photo Storage

- Photos stored as Base64 strings in database
- Max 5 photos per inspection
- Automatically compressed to ~80% JPEG quality
- Stored locally (IndexedDB) when offline
- Synced to server when online

## 🔄 Offline Sync Strategy

1. **Conflict Resolution**: Last-write-wins
2. **Sync Triggers**:
   - Manual sync button
   - Automatic on network reconnection
   - On app startup if online
3. **Data Priority**:
   - Inspections synced first
   - Photos synced with inspections
   - Form templates downloaded last

## 🎨 Customization

### Branding
- Update company name in `Navigation.js`
- Change primary color in `App.css` (`:root` variables)
- Replace logo/favicon in `public/` folder

### Form Categories
- Edit categories in database schema (`initDatabase.js`)
- Update category dropdown in `FormBuilder.js`

### Photo Limit
- Change limit in `InspectionForm.js` validation
- Update database schema if needed

## 🐛 Troubleshooting

### Database Connection Issues
```bash
# Check PostgreSQL is running
sudo service postgresql status

# Check connection string in .env
# Ensure database exists
psql -l
```

### Camera Not Working
- Check browser permissions
- Ensure HTTPS (required for camera on non-localhost)
- Try different browser

### Sync Failures
- Check network connection
- Verify backend API is accessible
- Check browser console for errors
- Review sync logs in database

### Build Errors
```bash
# Clear caches and reinstall
rm -rf node_modules package-lock.json
npm install
```

## 📝 License

Proprietary - LAMBERT ELECTROMEC LTD

## 🤝 Support

For support, contact: support@lambertelectromec.com

## 🔄 Version History

### v1.0.0 (Current)
- Initial release
- Full offline support
- Photo capture
- Form builder
- Three-tier user roles
- Approval workflow

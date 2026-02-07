# DEPLOYMENT GUIDE - Lambert Inspection Platform

## Quick Deployment Checklist

- [ ] PostgreSQL database created
- [ ] Backend environment variables configured
- [ ] Database initialized with tables
- [ ] Backend deployed and accessible
- [ ] Frontend environment variables updated
- [ ] Frontend built and deployed
- [ ] Test with default admin account
- [ ] Create actual users
- [ ] Test offline functionality
- [ ] Test photo capture
- [ ] Test sync functionality

## Option 1: Railway.app + Vercel (Recommended - FREE)

### Backend on Railway

1. **Create Railway Account**
   - Go to https://railway.app
   - Sign up with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Connect your GitHub repository
   - Select the `backend` folder

3. **Add PostgreSQL**
   - Click "New" → "Database" → "Add PostgreSQL"
   - Database will be automatically configured

4. **Set Environment Variables**
   ```
   NODE_ENV=production
   JWT_SECRET=[generate-secure-random-string]
   PORT=5000
   ```
   Note: DATABASE_URL is auto-set by Railway

5. **Initialize Database**
   - In Railway dashboard, go to your service
   - Click "Settings" → "Deploy"
   - After deployment, go to "Deploy logs"
   - Or SSH into the container and run: `npm run init-db`

6. **Get Backend URL**
   - Railway will provide a URL like: `https://your-app.up.railway.app`
   - Save this for frontend configuration

### Frontend on Vercel

1. **Create Vercel Account**
   - Go to https://vercel.com
   - Sign up with GitHub

2. **Import Project**
   - Click "Add New" → "Project"
   - Import your repository
   - Set root directory to `frontend`

3. **Configure Build Settings**
   - Framework Preset: Create React App
   - Build Command: `npm run build`
   - Output Directory: `build`

4. **Set Environment Variable**
   ```
   REACT_APP_API_URL=https://your-railway-backend-url.up.railway.app/api
   ```

5. **Deploy**
   - Click "Deploy"
   - Vercel will build and deploy automatically

6. **Access Your App**
   - Vercel provides URL like: `https://your-app.vercel.app`
   - Login with: admin@lambertelectromec.com / Admin@123

## Option 2: Heroku (All-in-One)

### Prerequisites
```bash
# Install Heroku CLI
curl https://cli-assets.heroku.com/install.sh | sh

# Login
heroku login
```

### Deploy Backend

```bash
cd backend

# Create Heroku app
heroku create lambert-inspection-api

# Add PostgreSQL
heroku addons:create heroku-postgresql:mini

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your-secure-secret-here

# Deploy
git init
git add .
git commit -m "Initial commit"
heroku git:remote -a lambert-inspection-api
git push heroku main

# Initialize database
heroku run npm run init-db
```

### Deploy Frontend

```bash
cd frontend

# Update .env with Heroku backend URL
echo "REACT_APP_API_URL=https://lambert-inspection-api.herokuapp.com/api" > .env

# Create Heroku app
heroku create lambert-inspection-app

# Add Node.js buildpack
heroku buildpacks:add heroku/nodejs

# Deploy
git init
git add .
git commit -m "Initial commit"
heroku git:remote -a lambert-inspection-app
git push heroku main
```

## Option 3: Render.com

### Backend Deployment

1. **Create Account** at https://render.com

2. **Create PostgreSQL Database**
   - Dashboard → New → PostgreSQL
   - Name: lambert-inspection-db
   - Plan: Free
   - Copy "Internal Database URL"

3. **Create Web Service**
   - Dashboard → New → Web Service
   - Connect GitHub repository
   - Name: lambert-inspection-backend
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Plan: Free

4. **Set Environment Variables**
   ```
   DATABASE_URL=[paste from step 2]
   NODE_ENV=production
   JWT_SECRET=[generate secure key]
   PORT=5000
   ```

5. **Initialize Database**
   - After deployment, use Shell access
   - Run: `npm run init-db`

### Frontend Deployment

1. **Create Web Service**
   - Dashboard → New → Static Site
   - Connect GitHub repository
   - Name: lambert-inspection-frontend
   - Build Command: `cd frontend && npm install && npm run build`
   - Publish Directory: `frontend/build`

2. **Set Environment Variable**
   ```
   REACT_APP_API_URL=https://lambert-inspection-backend.onrender.com/api
   ```

## Option 4: Self-Hosted VPS (DigitalOcean, AWS EC2, etc.)

### Server Setup (Ubuntu 22.04)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Nginx
sudo apt install -y nginx

# Install PM2 for process management
sudo npm install -g pm2
```

### Database Setup

```bash
# Create database
sudo -u postgres psql
CREATE DATABASE lambert_inspection;
CREATE USER lambert_user WITH ENCRYPTED PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE lambert_inspection TO lambert_user;
\q
```

### Backend Setup

```bash
# Clone or upload your code
git clone https://github.com/your-repo/lambert-inspection-platform.git
cd lambert-inspection-platform/backend

# Install dependencies
npm install --production

# Create .env file
cat > .env << EOF
DATABASE_URL=postgresql://lambert_user:secure_password@localhost:5432/lambert_inspection
JWT_SECRET=your-very-secure-secret-key
NODE_ENV=production
PORT=5000
EOF

# Initialize database
npm run init-db

# Start with PM2
pm2 start server.js --name lambert-backend
pm2 save
pm2 startup
```

### Frontend Setup

```bash
cd ../frontend

# Install dependencies
npm install

# Build production bundle
REACT_APP_API_URL=http://your-server-ip:5000/api npm run build

# Move to Nginx directory
sudo cp -r build /var/www/lambert-inspection
```

### Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/lambert-inspection
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        root /var/www/lambert-inspection;
        try_files $uri /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/lambert-inspection /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### SSL Certificate (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Post-Deployment Steps

### 1. Verify Backend

```bash
# Health check
curl https://your-backend-url/api/health

# Should return: {"status":"ok","timestamp":"..."}
```

### 2. Test Login

1. Open frontend URL
2. Login with default credentials:
   - Email: admin@lambertelectromec.com
   - Password: Admin@123

### 3. Change Default Password

1. Login as admin
2. Go to Settings → Change Password
3. Set a secure password

### 4. Create Users

1. Navigate to Users → Add User
2. Create accounts for:
   - Supervisors
   - Inspectors

### 5. Create Form Templates

1. Navigate to Forms → New Form
2. Create templates for:
   - QA/QC inspections
   - QHSE checklists
   - Equipment installation forms
   - Maintenance logs

### 6. Test Offline Functionality

1. Login as inspector
2. Open DevTools → Network tab
3. Check "Offline" mode
4. Create an inspection
5. Uncheck "Offline"
6. Click "Sync" button
7. Verify inspection appears online

### 7. Test Photo Capture

1. Create new inspection
2. Click "Take Photo"
3. Allow camera permissions
4. Capture photo
5. Add caption
6. Submit inspection
7. Verify photo appears in inspection details

## Production Security Checklist

- [ ] Change default admin password
- [ ] Generate strong JWT_SECRET (32+ characters)
- [ ] Enable HTTPS/SSL
- [ ] Configure CORS properly
- [ ] Set up database backups
- [ ] Enable rate limiting
- [ ] Set up monitoring/logging
- [ ] Review user permissions
- [ ] Test password reset flow
- [ ] Enable two-factor authentication (future enhancement)

## Monitoring & Maintenance

### Database Backups

```bash
# Manual backup
pg_dump -U lambert_user lambert_inspection > backup_$(date +%Y%m%d).sql

# Restore backup
psql -U lambert_user lambert_inspection < backup_20240101.sql
```

### Log Monitoring

```bash
# View PM2 logs (if using PM2)
pm2 logs lambert-backend

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Performance Monitoring

Set up monitoring with:
- Sentry (error tracking)
- LogRocket (session replay)
- Google Analytics (usage analytics)

## Scaling Considerations

### When to Scale

- More than 100 concurrent users
- Database size > 10GB
- API response time > 500ms
- High photo upload volume

### Scaling Options

1. **Database**
   - Upgrade to larger PostgreSQL instance
   - Enable connection pooling
   - Add read replicas

2. **Backend**
   - Horizontal scaling with load balancer
   - Enable caching (Redis)
   - Optimize database queries

3. **Photo Storage**
   - Move to S3/Cloud Storage
   - Implement CDN
   - Add image optimization

## Troubleshooting Deployment

### Backend Won't Start

```bash
# Check logs
pm2 logs lambert-backend

# Common issues:
# - Wrong DATABASE_URL format
# - Missing environment variables
# - Port already in use
```

### Frontend Can't Connect to Backend

1. Check REACT_APP_API_URL in frontend .env
2. Verify backend is accessible
3. Check CORS configuration
4. Verify Nginx proxy settings (if self-hosted)

### Database Connection Failed

1. Verify DATABASE_URL format
2. Check database is running
3. Verify firewall rules
4. Test connection manually:
   ```bash
   psql postgresql://user:pass@host:5432/dbname
   ```

### Offline Mode Not Working

1. Check browser supports IndexedDB
2. Verify Service Worker is registered
3. Check browser console for errors
4. Try in Incognito mode to rule out extensions

## Support

For deployment assistance:
- Email: support@lambertelectromec.com
- Documentation: https://docs.lambertelectromec.com

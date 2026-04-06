# PaperFormat — Academic Paper Formatting Service

## Project Structure

```
paperformat/
├── frontend-vercel/          # Deploy this entire folder to Vercel
│   ├── index.html            # Public lead capture page
│   ├── admin.html            # Admin dashboard (protected)
│   ├── script.js             # Form submission logic
│   ├── admin.js              # Admin dashboard logic
│   └── vercel.json           # Vercel routing config
│
└── backend-railway/          # Deploy this entire folder to Railway
    ├── main.py               # FastAPI application (all endpoints)
    ├── requirements.txt      # Python dependencies
    ├── Procfile              # Process start command
    └── railway.json          # Railway deployment config
```

---

## Step-by-Step Deployment

### 1. Deploy the Backend to Railway

1. Create a free account at https://railway.app
2. In your terminal, navigate to the project root:
   ```
   cd paperformat
   ```
3. Push ONLY the backend folder as a separate git repo:
   ```
   cd backend-railway
   git init
   git add .
   git commit -m "Initial backend deploy"
   ```
4. In the Railway dashboard, click "New Project" > "Deploy from GitHub repo"
   OR use the Railway CLI:
   ```
   npm install -g @railway/cli
   railway login
   railway init
   railway up
   ```
5. Set environment variables in Railway dashboard (Settings > Variables):
   ```
   ADMIN_USER=admin
   ADMIN_PASS=your_secure_password_here
   UPLOAD_DIR=./uploads
   ```
6. Railway will auto-detect the Procfile and start the server.
7. Copy your Railway public URL — it will look like:
   ```
   https://your-app-name.railway.app
   ```

---

### 2. Link the Backend URL to the Frontend

Before deploying the frontend, open BOTH JavaScript files and replace the placeholder:

In `frontend-vercel/script.js` (line 7):
```js
const BACKEND_URL = "https://your-app-name.railway.app";
```

In `frontend-vercel/admin.js` (line 7):
```js
const BACKEND_URL = "https://your-app-name.railway.app";
```

Also update the admin credentials in `admin.js` (lines 14-15) to match
what you set in Railway environment variables:
```js
const ADMIN_USER = "admin";
const ADMIN_PASS = "your_secure_password_here";
```

---

### 3. Deploy the Frontend to Vercel

1. Create a free account at https://vercel.com
2. Navigate to the frontend folder and initialize a git repo:
   ```
   cd ../frontend-vercel
   git init
   git add .
   git commit -m "Initial frontend deploy"
   ```
3. Push to GitHub (Vercel reads from GitHub):
   ```
   git remote add origin https://github.com/YOUR_USERNAME/paperformat-frontend.git
   git push -u origin main
   ```
4. In Vercel dashboard: "Add New Project" > import the GitHub repo.
5. Framework Preset: **Other** (it is a static site, no framework needed).
6. Root Directory: leave as `/` (the frontend-vercel folder is the repo root).
7. Click "Deploy". Vercel will serve your static files immediately.
8. Your site will be live at: `https://your-project.vercel.app`

---

## Accessing the Admin Dashboard

Navigate to:
```
https://your-project.vercel.app/admin.html
```

Default login:
- Username: `admin`
- Password: `paperformat2024`

**Change these before going live** via Railway environment variables and
updating the matching values in `admin.js`.

---

## Environment Variables Reference

| Variable     | Where Set | Description                        | Default            |
|--------------|-----------|------------------------------------|--------------------|
| ADMIN_USER   | Railway   | Admin login username               | admin              |
| ADMIN_PASS   | Railway   | Admin login password               | paperformat2024    |
| UPLOAD_DIR   | Railway   | Directory to save uploaded files   | ./uploads          |
| DATABASE_URL | Railway   | SQLite or Postgres connection URL  | sqlite:///./orders.db |
| PORT         | Railway   | Auto-set by Railway, do not touch  | (auto)             |

---

## API Endpoints

| Method | Path                        | Auth     | Description                  |
|--------|-----------------------------|----------|------------------------------|
| GET    | /                           | None     | Health check                 |
| GET    | /health                     | None     | Health check                 |
| POST   | /orders                     | None     | Submit new order (multipart) |
| GET    | /orders                     | Basic    | List all orders              |
| GET    | /orders/{id}                | Basic    | Get single order             |
| PATCH  | /orders/{id}/status         | Basic    | Update order status          |
| GET    | /uploads/{filename}         | None     | Download uploaded file       |

---

## Notes

- SQLite is used by default and stored in `orders.db` inside the Railway
  container. For production persistence, provision a Railway Postgres database
  and set DATABASE_URL accordingly (the code supports both via SQLAlchemy).
- Uploaded files are stored in the Railway container's filesystem. For
  durable file storage in production, integrate with Cloudflare R2 or AWS S3.
- The admin login is a client-side check for simplicity. For higher security,
  move authentication to the backend and issue a session token.

# InsightHub 

## Project Overview
REST API for InsightHub - Built with Node.js, Express and PostgreSQL.

## Deployment Link
- Backend: https://insighthub-backend-aqi5.onrender.com

## Technology Stack
- Node.js
- Express
- PostgreSQL
- bcryptjs (password hashing)
- jsonwebtoken (authentication)

## API Endpoints
### Authentication
- POST /api/register — Register new user
- POST /api/login — Login and get token

### Projects
- GET /api/projects — Get all approved projects (with search/filter)
- GET /api/projects/:id — Get single project
- POST /api/projects — Submit new project (protected)

### Bookmarks
- POST /api/bookmarks/:projectId — Bookmark a project (protected)
- GET /api/bookmarks — Get user's bookmarks (protected)

### Comments
- POST /api/comments/:projectId — Add comment (protected)
- GET /api/comments/:projectId — Get all comments for a project

### Admin
- GET /api/admin/projects — Get all projects (admin only)
- PUT /api/admin/projects/:id — Approve or reject project (admin only)
- DELETE /api/admin/projects/:id — Delete project (admin only)

## Installation Instructions
1. Clone the repo
2. Run npm install
3. Create .env file with:
   - DATABASE_URL=your_postgres_url
   - JWT_SECRET=your_secret
   - PORT=4040
4. Run node server.js

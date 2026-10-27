# Modern HRM — MERN Stack

An educational Human Resource Management System starter with separate `client/` (React + Vite) and `server/` (Express + MongoDB/Mongoose) applications.

## Included
- JWT registration/login and bcrypt password hashing
- Role-aware employee, manager, and HR navigation/dashboard foundation
- Employee directory, attendance check-in/check-out, leave requests and review workflow
- Announcements and training pages
- MongoDB-backed REST API and protected endpoints
- Responsive dashboard UI

## Scope and verification
This is a working starter foundation, **not a complete production HR suite**. The full prompt's advanced modules (such as persisted notification workflows, comprehensive reporting/export, performance review workflows, manager-team scoping in every endpoint, automated test coverage, and exhaustive CRUD across all modules) may require additional implementation. It has not been verified end-to-end against a live MongoDB instance in this environment. Run the checklist below before presenting it as fully tested.

## Requirements
- Node.js 18+ (Node.js 20 LTS recommended)
- MongoDB Community Server or MongoDB Atlas
- npm

## Run in VS Code on Windows
1. Extract the ZIP and open the `modern-hrm-mern` folder in VS Code.
2. Start MongoDB locally or prepare an Atlas connection string.
3. In a terminal:
   ```powershell
   cd server
   copy .env.example .env
   npm install
   npm run dev
   ```
4. Edit `server/.env` and set `MONGODB_URI` and a long random `JWT_SECRET`.
5. Open a second terminal:
   ```powershell
   cd client
   npm install
   npm run dev
   ```
6. Open the Vite URL shown in the terminal (normally `http://localhost:5173`).
7. Test the backend at `http://localhost:5000/api/health`.

On macOS/Linux, use `cp .env.example .env` instead of `copy`.

## Configuration
`server/.env.example` contains the backend settings. Never commit `.env` or real employee data. Ensure the frontend API URL in `client/src/api.js` matches the backend URL.

## Roles
Public registration should create an employee account only. For local project demonstrations, an authorized developer can change a user's role directly in the local MongoDB database. Do not expose role editing publicly; privileged role changes must be server-authorized.

## Before demo / acceptance checklist
- [ ] Confirm MongoDB connects and `/api/health` returns success
- [ ] Test registration, login, logout, and invalid credentials
- [ ] Verify public registration cannot assign HR/manager privileges
- [ ] Test role permissions by calling APIs directly, not only hiding UI buttons
- [ ] Test duplicate check-in, check-out without check-in, and attendance history
- [ ] Submit a leave request and review it as an authorized manager/HR user
- [ ] Test employee CRUD/deactivation and persistence after refresh
- [ ] Test announcement and training changes against MongoDB
- [ ] Test mobile layout, loading states, and API error states

## Security note
This is a college-project foundation, not a compliance-certified HR/payroll product. Before deployment, add stronger request validation, rate limiting, security headers, audit logging, password reset/email verification, complete automated tests, and a deployment security review.

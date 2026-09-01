<div align="center">

# 🏢 Enterprise HR Management System

**A full-stack, enterprise-grade Human Resource Management platform built for performance, security, and legacy compatibility.**

[![Node.js](https://img.shields.io/badge/Node.js-v18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![SQL Server](https://img.shields.io/badge/SQL_Server-2019+-CC2927?style=for-the-badge&logo=microsoftsqlserver&logoColor=white)](https://www.microsoft.com/en-us/sql-server)
[![License](https://img.shields.io/badge/License-Proprietary-red?style=for-the-badge)](#license)

</div>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
- [Environment Variables](#environment-variables)
- [Running the Application](#running-the-application)
- [Project Structure](#project-structure)
- [License](#license)

---

## Overview

The **Enterprise HR Management System** is a production-ready, full-stack web application designed to manage employee lifecycles, payroll, document management, role-based access control, and real-time operational KPIs. It replaces a legacy desktop system while maintaining full backward compatibility with existing databases and infrastructure — including support for older browsers (Windows 7 / Chrome 49+).

The system is built with an **Arabic RTL-first** interface, province-based data isolation for multi-region deployments, and comprehensive audit logging.

---

## Tech Stack

| Layer | Technology | Version |
|:------|:-----------|:--------|
| **Frontend** | React | 19 |
| **Build Tool** | Vite | 8 |
| **Styling** | Tailwind CSS | 4 |
| **State Management** | Zustand | 5 |
| **Data Fetching** | SWR | 2 |
| **Charts** | Recharts | 3 |
| **Routing** | React Router DOM | 7 |
| **Backend** | Express.js | 4 |
| **ORM** | Prisma | 7 |
| **Database** | Microsoft SQL Server | 2019+ |
| **Authentication** | JSON Web Tokens (JWT) | 9 |
| **File Upload** | Multer | 2 |
| **Security** | Helmet, CORS, bcryptjs | Latest |

---

## Key Features

### 🚀 Enterprise Performance
- **SQL Server Indexing** — Production-grade `@@index` directives on the Prisma schema and dedicated `performance_indexes.sql` for high-traffic query paths.
- **Strict API Payloads** — Selective `select` clauses on every Prisma query to minimize data transfer and prevent over-fetching.
- **Server-Side Caching** — `node-cache` for frequently accessed, slow-changing data (settings, lookup tables).

### 📄 Advanced Document Management
- **Bulk Deletion** — Multi-select bulk delete with physical file removal via `fs.unlinkSync`, ensuring no orphaned files remain on disk.
- **Multer Integration** — Secure file uploads for employee images and documents with configurable size limits and MIME-type validation.

### 📊 Real-Time Actionable KPIs
- **Dashboard Polling** — Real-time KPI panels (headcount, leaves, state distributions) powered by SWR's polling interval for live operational dashboards.
- **Interactive Charts** — Recharts-powered visualizations with drill-down capabilities.

### 🖥️ Legacy System Compatibility
- **Dual-Bundle Output** — `@vitejs/plugin-legacy` generates a modern ES module bundle *and* a SystemJS legacy bundle, ensuring compatibility with **Chrome 49+, Firefox 52+, Safari 10+** (including Windows 7 machines).
- **CSS Downleveling** — LightningCSS configured with explicit browser targets to transpile modern CSS features for older engines.

### 🔍 Search State Retention
- **Persistent Filters** — Search queries, filters, and pagination state are preserved across navigation using Zustand stores, so users never lose context when switching between views.

### 🔐 Security & Access Control
- **Role-Based Access Control (RBAC)** — Granular permissions via legacy-compatible `checkBox*` boolean keys controlling UI visibility and API access.
- **Province-Based Data Isolation** — Multi-region data filtering ensuring users only see records for their authorized provinces.
- **JWT Authentication** — Stateless token-based auth with configurable expiration.
- **Audit Logging** — Every data mutation is recorded in the `SystemRecords` table with user, timestamp, and action details.

### 🌍 RTL & Localization
- **Arabic-First Interface** — Full Right-to-Left layout with `dir="rtl"` applied across all components.
- **Excel Export** — Server-side Excel generation via `exceljs` with RTL-aware formatting.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT (React 19)                    │
│  Vite 8 · Tailwind v4 · Zustand · SWR · React Router 7     │
│  Legacy Bundle (SystemJS) + Modern Bundle (ESM)             │
├─────────────────────────────────────────────────────────────┤
│                        REST API (Express 4)                 │
│  Controllers → Services → Prisma ORM                        │
│  JWT Auth · Helmet · CORS · Morgan · Multer                 │
├─────────────────────────────────────────────────────────────┤
│                     DATABASE (SQL Server)                    │
│  Prisma Schema (Introspected) · Performance Indexes         │
│  Province-Based Row-Level Filtering                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

Before you begin, ensure the following are installed:

- **Node.js** ≥ 18.x — [Download](https://nodejs.org/)
- **npm** ≥ 9.x (bundled with Node.js)
- **Microsoft SQL Server** 2019+ (or SQL Server Express)
- **Git** ≥ 2.x

---

## Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/moussa-ms13/HR-WebApp.git
cd HR-WebApp
```

### 2. Install Dependencies

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the `server/` directory:

```bash
cp server/.env.example server/.env
```

Then edit `server/.env` with your actual values (see [Environment Variables](#environment-variables) below).

### 4. Set Up the Database

```bash
cd server

# Generate Prisma Client from the schema
npm run prisma:generate

# Push schema to your SQL Server database
npm run prisma:push

# (Optional) Seed initial data
npm run seed
```

### 5. Apply Performance Indexes

Run the SQL script against your database to create optimized indexes:

```bash
# Using sqlcmd or SQL Server Management Studio (SSMS):
# Execute server/prisma/performance_indexes.sql
```

---

## Environment Variables

Create `server/.env` with the following variables:

| Variable | Description | Example |
|:---------|:------------|:--------|
| `DATABASE_URL` | Prisma connection string for SQL Server | `sqlserver://localhost:1433;database=RafatDB;user=...;password=...` |
| `DB_SERVER` | SQL Server hostname | `localhost` |
| `DB_PORT` | SQL Server port | `1433` |
| `DB_NAME` | Database name | `RafatDB` |
| `DB_USER` | SQL Server username | `hrwebapp_user` |
| `DB_PASSWORD` | SQL Server password | `••••••••` |
| `JWT_SECRET` | Secret key for JWT signing | (generate a strong random string) |
| `JWT_EXPIRES_IN` | Token expiration duration | `8h` |
| `PORT` | Server port | `5000` |
| `NODE_ENV` | Environment mode | `development` or `production` |
| `CLIENT_URL` | Frontend URL (for CORS) | `http://localhost:5173` |

> ⚠️ **Never commit the `.env` file.** It contains database credentials and JWT secrets.

---

## Running the Application

### Development Mode

Open two terminal windows:

```bash
# Terminal 1 — Start the API server (auto-restarts on changes)
cd server
npm run dev

# Terminal 2 — Start the Vite dev server (HMR enabled)
cd client
npm run dev
```

- **Frontend:** [http://localhost:5173](http://localhost:5173)
- **Backend API:** [http://localhost:5000](http://localhost:5000)

### Production Build

```bash
# Build the client (generates modern + legacy bundles)
cd client
npm run build

# Start the production server
cd ../server
npm start
```

### Prisma Studio (Database GUI)

```bash
cd server
npm run prisma:studio
```

---

## Project Structure

```
HR-WebApp/
├── client/                     # Frontend Application
│   ├── public/                 # Static assets
│   ├── src/
│   │   ├── assets/             # Images, icons
│   │   ├── components/         # Reusable UI components
│   │   ├── context/            # React context providers
│   │   ├── pages/              # Route-level page components
│   │   ├── services/           # Axios API client modules
│   │   ├── utils/              # Constants, helpers
│   │   ├── App.jsx             # Root component & routing
│   │   ├── App.css             # Application styles
│   │   ├── index.css           # Global / Tailwind base styles
│   │   └── main.jsx            # Entry point
│   ├── vite.config.js          # Vite + Legacy plugin config
│   └── package.json
│
├── server/                     # Backend API
│   ├── src/
│   │   ├── config/             # Database & app configuration
│   │   ├── controllers/        # Route handlers
│   │   ├── middleware/         # Auth, upload, error handling
│   │   ├── routes/             # Express route definitions
│   │   ├── services/           # Business logic layer
│   │   ├── utils/              # Shared utilities & constants
│   │   └── server.js           # Express app entry point
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema (introspected)
│   │   ├── performance_indexes.sql  # SQL Server index scripts
│   │   └── seed.js             # Database seeder
│   └── package.json
│
├── uploads/                    # User-uploaded files (gitignored)
│   ├── employee_images/
│   └── employee_documents/
│
├── .gitignore
└── README.md
```

---

## License

This project is **proprietary software**. All rights reserved.  
Unauthorized copying, distribution, or modification is strictly prohibited.

---

<div align="center">

**Built with مديرية الفرعية للرقمة بمديرية الجهوية للأملاك الوطنية ناحية الشلف for enterprise HR operations.**

</div>

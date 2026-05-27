# 🏠 Propsense AI Renovation Estimator

> An intelligent AI-powered platform that transforms property exterior analysis into accurate renovation cost estimates and stunning visual redesigns.

---

## 🎯 What Is This?

Propsense detects architectural regions in property photos, maps them to specific materials, and generates accurate renovation cost estimates — all powered by Google Gemini AI.

---

## 🚀 Key Achievements

- ✅ **AI-Powered Region Detection** — Automatically identifies structural regions (walls, roofs, doors, windows) in property photos
- ✅ **Smart Material Mapping** — Assign materials like Paint, Stone Cladding, Brick, etc. to each detected region
- ✅ **Dynamic Cost Estimation** — Real-time calculation of material and labor costs based on custom market rates
- ✅ **AI Visualization** — Generates redesigned visual options for the property exterior using Gemini
- ✅ **Professional PDF Reporting** — Export detailed cost breakdowns directly to PDF via jsPDF
- ✅ **Load Balancing** — Backend scaled with Docker + Nginx for production reliability
- ✅ **Cloud Deployment** — Frontend on Cloudflare Pages, Backend on Render via Docker

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Vite 8, Tailwind CSS v4, Shadcn/UI, Lucide Icons, jsPDF |
| **Backend** | Python 3.10+, FastAPI, Google Gemini API |
| **DevOps** | Docker, Nginx (load balancing), Render, Cloudflare Pages |

---

## 📥 Getting Started

### Prerequisites

Before you begin, make sure you have the following installed:

- [Node.js](https://nodejs.org/) `v22.0.0+`
- [Python](https://www.python.org/) `v3.10+`
- [Git](https://git-scm.com/)
- [Docker](https://www.docker.com/) *(optional — for containerized deployment)*

---

### 1. Clone the Repository

```bash
git clone https://github.com/SumithKumar765/ai-renovation-estimator.git
cd ai-renovation-estimator
```

---

### 2. Backend Setup

```bash
cd backend

# Create a virtual environment
python -m venv venv

# Activate the virtual environment
source venv/bin/activate        # macOS / Linux
# venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt

# Run the development server
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

> Backend will be available at: `http://localhost:8000`

---

### 3. Frontend Setup

```bash
cd ../frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

> Frontend will be available at: `http://localhost:5173`

---

## ⚙️ Environment Variables

Create `.env` files in the respective directories before running:

**`backend/.env`**

```env
GEMINI_API_KEY=your_google_gemini_api_key_here
```

**`frontend/.env`**

```env
VITE_API_URL=http://localhost:8000
# In production: VITE_API_URL=https://your-render-backend-url.com
```

---

## 🚢 Deployment

### Frontend — Cloudflare Pages

| Setting | Value |
|---------|-------|
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Node Version | `22.0.0` |

### Backend — Render (Docker)

- Uses `Dockerfile` in the `/backend` directory
- Nginx configured as a reverse proxy / load balancer
- Environment variables set via Render dashboard

---

## 📁 Project Structure

```
ai-renovation-estimator/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── main.jsx
│   ├── public/
│   ├── package.json
│   └── vite.config.js
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   └── routes/
│   ├── requirements.txt
│   └── Dockerfile
└── README.md
```

---

## 🔄 Updating Your Local Copy

```bash
# Pull the latest changes
git pull origin main

# Backend — install any new dependencies
cd backend
pip install -r requirements.txt

# Frontend — install any new packages
cd ../frontend
npm install
```

---

## 📄 License

This project is **proprietary** and intended exclusively for use by **Propsense**.  
Unauthorized copying, distribution, or modification is not permitted.

---

<p align="center">Built with ❤️ by Sumith kumar </p>

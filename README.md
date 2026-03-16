# TechPro AI

A full-stack AI chat app with Python Flask backend, Firebase Auth, Firestore, and Groq AI.

## Project Structure

```
techpro-ai/
├── app.py                  ← Python Flask backend
├── requirements.txt        ← Python dependencies
├── templates/
│   └── index.html          ← Main HTML (clean, no inline CSS/JS)
└── static/
    ├── css/
    │   └── styles.css      ← All styles
    └── js/
        └── app.js          ← All frontend logic
```

## Setup & Run

### Step 1 — Install Python dependencies
```bash
pip install -r requirements.txt
```

### Step 2 — Add your Groq API key
Open `app.py` and set:
```python
GROQ_API_KEY = "your_groq_key_here"
```

### Step 3 — Run the server
```bash
python app.py
```

### Step 4 — Open in browser
Go to: **http://localhost:5000**

---

## Tech Stack

| Layer     | Technology               |
|-----------|--------------------------|
| Backend   | Python Flask             |
| AI        | Groq API (Llama 3.3 70B) |
| Auth      | Firebase Authentication  |
| Database  | Firebase Firestore       |
| Frontend  | HTML + CSS + Vanilla JS  |

---

## Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Enable **Authentication** → Google + Phone
3. Enable **Firestore** → Create database in test mode
4. Add **Authorized Domain**: `localhost`

## Groq API

Get your free key at: https://console.groq.com/keys

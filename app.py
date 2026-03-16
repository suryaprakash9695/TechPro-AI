"""
TechPro AI — Python Flask Backend
Setup: pip install -r requirements.txt && python app.py
All secrets are loaded from .env file.
"""

from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from dotenv import load_dotenv
import requests, os, json

load_dotenv()

app = Flask(__name__)
CORS(app)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL   = os.getenv("GROQ_MODEL",   "llama-3.3-70b-versatile")
GROQ_URL     = "https://api.groq.com/openai/v1/chat/completions"
FLASK_PORT   = int(os.getenv("FLASK_PORT", 5000))
FLASK_DEBUG  = os.getenv("FLASK_DEBUG", "true").lower() == "true"

FIREBASE_CONFIG = {
    "apiKey":            os.getenv("FIREBASE_API_KEY",            ""),
    "authDomain":        os.getenv("FIREBASE_AUTH_DOMAIN",        ""),
    "projectId":         os.getenv("FIREBASE_PROJECT_ID",         ""),
    "storageBucket":     os.getenv("FIREBASE_STORAGE_BUCKET",     ""),
    "messagingSenderId": os.getenv("FIREBASE_MESSAGING_SENDER_ID",""),
    "appId":             os.getenv("FIREBASE_APP_ID",             ""),
}

@app.route("/")
def index():
    return render_template("index.html", firebase_config=json.dumps(FIREBASE_CONFIG))

@app.route("/api/chat", methods=["POST"])
def chat():
    try:
        data     = request.get_json()
        messages = data.get("messages", [])
        if not messages:
            return jsonify({"error": "No messages provided"}), 400
        if not GROQ_API_KEY:
            return jsonify({"error": "GROQ_API_KEY not set in .env file"}), 500

        response = requests.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
            json={"model": GROQ_MODEL, "messages": messages, "max_tokens": 2048, "temperature": 0.7},
            timeout=30,
        )
        result = response.json()
        if "error" in result:
            return jsonify({"error": result["error"]["message"]}), 500
        return jsonify({"reply": result["choices"][0]["message"]["content"]})

    except requests.exceptions.Timeout:
        return jsonify({"error": "Request timed out. Please try again."}), 504
    except requests.exceptions.ConnectionError:
        return jsonify({"error": "Could not connect to AI server."}), 503
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/health")
def health():
    return jsonify({"status": "online", "model": GROQ_MODEL, "groq_configured": bool(GROQ_API_KEY)})

if __name__ == "__main__":
    print("=" * 45)
    print("  TechPro AI")
    print(f"  Model : {GROQ_MODEL}")
    print(f"  Groq  : {'OK' if GROQ_API_KEY else 'MISSING — check .env'}")
    print("=" * 45)

    port = int(os.environ.get("PORT", 5000))  # Render provides PORT
    app.run(host="0.0.0.0", port=port)
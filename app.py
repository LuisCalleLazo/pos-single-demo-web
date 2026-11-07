import os

from flask import Flask, render_template

app = Flask(__name__)


@app.route("/")
def index():
    data = {
        "titulo": "Mini POS",
        "tienda": "Mi Tienda",
        "moneda": "Bs.",
    }
    return render_template("index.html", data=data)


@app.route("/health")
def health():
    # Útil para healthchecks en el hosting
    return {"status": "ok"}


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)

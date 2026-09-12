import os


os.environ["TOKUP_DATABASE_URL"] = "sqlite:////tmp/tokup-ci.db"
os.environ["TOKUP_ADMIN_EMAIL"] = ""
os.environ["TOKUP_ADMIN_PASSWORD"] = ""
os.environ["SENTRY_DSN"] = ""

from fastapi.testclient import TestClient

from main import app


def test_health():
    client = TestClient(app, base_url="http://localhost")
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["name"] == "TokUp"

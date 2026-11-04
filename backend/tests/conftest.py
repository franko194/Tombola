import os

# Must run before the app is imported: these values configure organizer login for every test.
os.environ["DATABASE_URL"] = "sqlite:///./data/test_ia_friday.db"
os.environ["SESSION_SECRET"] = "test-secret"
os.environ["ORGANIZER_EMAILS"] = "organizador@example.com"

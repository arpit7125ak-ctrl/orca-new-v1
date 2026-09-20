"""
app/config/settings.py

Environment configuration, loaded once at import time.

WHY FAIL-FAST: the Backend's env.js does the same thing deliberately - if a
required secret is missing, the process dies at startup with a clear message
rather than serving requests that mysteriously 401 an hour later. INTERNAL_SECRET
in particular MUST be byte-identical to the Backend's or every callback fails.
"""

import os
import sys
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


class Settings:
    # --- Service ----------------------------------------------------------
    AI_SERVICE_PORT: int = int(os.getenv("AI_SERVICE_PORT", "8000"))
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO").upper()
    ENV: str = os.getenv("ENV", "development")

    # --- Backend internal API --------------------------------------------
    # Port 4100, NOT 4000. 4000 is the Frontend-facing public API and does not
    # expose /internal/v1/* at all.
    BACKEND_INTERNAL_URL: str = os.getenv("BACKEND_INTERNAL_URL", "http://localhost:4100")
    INTERNAL_SECRET: str = os.getenv("INTERNAL_SECRET", "")

    # Token lifetime for outbound calls. The Backend mints 120s tokens; we
    # match that. Short-lived by design - a leaked token expires in two minutes.
    INTERNAL_TOKEN_TTL_SECONDS: int = 120

    # JWT claim values. These are REVERSED relative to the Backend's outbound
    # tokens: we are the issuer, the Backend is the audience.
    TOKEN_ISSUER: str = "orca-ai-service"
    TOKEN_AUDIENCE: str = "orca-backend"

    # --- Gemini -----------------------------------------------------------
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
    USE_MOCK_LLM: bool = os.getenv("USE_MOCK_LLM", "false").lower() == "true"

    # --- Adapters & Data Feeds --------------------------------------------
    ADAPTER_MODE: str = os.getenv("ADAPTER_MODE", "mock")
    MONGO_URI: str = os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017")
    MONGO_DB: str = os.getenv("MONGO_DB", "orca")

    # --- External Data Feeds & APIs (Overridable via .env) ----------------
    OPEN_METEO_WEATHER_URL: str = os.getenv(
        "OPEN_METEO_WEATHER_URL", "https://api.open-meteo.com/v1/forecast"
    )
    OPEN_METEO_MARINE_URL: str = os.getenv(
        "OPEN_METEO_MARINE_URL", "https://marine-api.open-meteo.com/v1/marine"
    )
    SACHET_ALERTS_URL: str = os.getenv(
        "SACHET_ALERTS_URL", "https://sachet.ndma.gov.in/cap_public_website/FetchAllAlertDetails"
    )
    GEBCO_BATHYMETRY_URL: str = os.getenv(
        "GEBCO_BATHYMETRY_URL", "https://api.opentopodata.org/v1/gebco2020"
    )

    # --- Paths ------------------------------------------------------------
    # contracts/ and shared-config/ are SIBLINGS of ai-service/, shared with the
    # Backend. Neither service owns them; both read the same files. This is what
    # stops the two services drifting apart on field names and enums.
    _HERE = os.path.dirname(os.path.abspath(__file__))
    REPO_ROOT: str = os.path.abspath(os.path.join(_HERE, "..", "..", ".."))
    CONTRACTS_DIR: str = os.path.join(REPO_ROOT, "contracts")
    SHARED_CONFIG_DIR: str = os.path.join(REPO_ROOT, "shared-config")

    # --- Risk tuning (Section 51.2 / 52) ---------------------------------
    # The LLM may nudge a baseline score by at most this much, in either
    # direction. It can never cross below a constraint floor, and never drop a
    # score across a level boundary downward. See risk/risk_agent.py.
    LLM_ADJUSTMENT_BAND: int = int(os.getenv("LLM_ADJUSTMENT_BAND", "10"))

    # Section 52 risk level thresholds, 0-100. Configurable by design.
    RISK_SAFE_MAX: int = int(os.getenv("RISK_SAFE_MAX", "34"))
    RISK_CAUTION_MAX: int = int(os.getenv("RISK_CAUTION_MAX", "64"))
    RISK_UNSAFE_MAX: int = int(os.getenv("RISK_UNSAFE_MAX", "84"))

    # --- Timeouts (Section 34) -------------------------------------------
    AGENT_TIMEOUT_SECONDS: float = float(os.getenv("AGENT_TIMEOUT_SECONDS", "20"))
    BACKEND_POST_TIMEOUT_SECONDS: float = float(os.getenv("BACKEND_POST_TIMEOUT_SECONDS", "10"))

    def validate(self) -> None:
        """Die immediately on a misconfiguration that would break at runtime."""
        problems = []

        if not self.INTERNAL_SECRET:
            problems.append(
                "INTERNAL_SECRET is required and must match the Backend's value exactly. "
                "Without it every callback to the Backend returns 401."
            )

        if not self.USE_MOCK_LLM and not self.GEMINI_API_KEY:
            problems.append(
                "GEMINI_API_KEY is required unless USE_MOCK_LLM=true. "
                "Set one or the other - the service will not silently fabricate LLM output."
            )

        if not os.path.isdir(self.CONTRACTS_DIR):
            problems.append(
                f"contracts/ not found at {self.CONTRACTS_DIR}. "
                "ai-service/ must be a sibling of contracts/ and backend/."
            )

        if not os.path.isdir(self.SHARED_CONFIG_DIR):
            problems.append(
                f"shared-config/ not found at {self.SHARED_CONFIG_DIR}. "
                "ai-service/ must be a sibling of shared-config/ and backend/."
            )

        if self.ADAPTER_MODE not in ("mock", "real"):
            problems.append(f"ADAPTER_MODE must be 'mock' or 'real', got '{self.ADAPTER_MODE}'.")

        if problems:
            print("\n[config] FATAL - cannot start:\n", file=sys.stderr)
            for p in problems:
                print(f"  - {p}", file=sys.stderr)
            print("", file=sys.stderr)
            sys.exit(1)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    s = Settings()
    s.validate()
    return s


settings = get_settings()

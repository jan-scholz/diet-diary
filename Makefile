# Diet Diary — dev tasks
#
#   make serve        run the static app on http://localhost:8000
#   make install      install test deps (Playwright + Chromium)
#   make verify       run the end-to-end Playwright suite
#   make screenshots  regenerate the docs/ screenshots (incl. hero.png)
#
# Override the port with: make serve PORT=9000

PORT ?= 8000

.PHONY: serve install verify screenshots

# Serve the static files (app is plain HTML/JS, no build step).
serve:
	uv run python -m http.server $(PORT)

# All dependencies: Playwright/Chromium for the tests. The QR libraries are
# vendored in vendor/ (see vendor/README.md) — nothing to download for the app.
install: scripts/node_modules

# Test toolchain — only (re)installed when scripts/node_modules is absent.
scripts/node_modules:
	cd scripts && npm install && npx playwright install chromium

# Start the server, run the suite against it, then tear the server down.
# Port-scoped log so parallel `make verify PORT=...` runs don't clobber each other.
verify: scripts/node_modules
	@uv run python -m http.server $(PORT) > /tmp/dd-server-$(PORT).log 2>&1 & \
	SERVER_PID=$$!; \
	sleep 1.5; \
	node scripts/verify.cjs http://localhost:$(PORT); \
	STATUS=$$?; \
	kill $$SERVER_PID 2>/dev/null; \
	exit $$STATUS

# Regenerate the repo screenshots in docs/ (seeds demo data in a headless browser).
screenshots: scripts/node_modules
	@uv run python -m http.server $(PORT) > /tmp/dd-server-$(PORT).log 2>&1 & \
	SERVER_PID=$$!; \
	sleep 1.5; \
	node scripts/screenshots.cjs http://localhost:$(PORT); \
	STATUS=$$?; \
	kill $$SERVER_PID 2>/dev/null; \
	exit $$STATUS

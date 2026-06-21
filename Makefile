# Diet Diary — dev tasks
#
#   make serve        run the static app on http://localhost:8000
#   make install      fetch QR libraries + install test deps (Playwright)
#   make verify       run the end-to-end Playwright suite
#   make screenshots  regenerate the docs/ screenshots (incl. hero.png)
#
# Override the port with: make serve PORT=9000

PORT ?= 8000

QRCODEGEN_URL := https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js
JSQR_URL      := https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js

.PHONY: serve install verify screenshots libs clean

# Serve the static files (app is plain HTML/JS, no build step).
serve: libs
	uv run python -m http.server $(PORT)

# All dependencies: vendored QR libraries + Playwright/Chromium for the tests.
install: libs scripts/node_modules

# Vendored, self-hosted QR libraries (downloaded only if missing).
libs: qrcodegen.js jsQR.js

qrcodegen.js:
	curl -fsSL -o $@ $(QRCODEGEN_URL)

jsQR.js:
	curl -fsSL -o $@ $(JSQR_URL)

# Test toolchain — only (re)installed when scripts/node_modules is absent.
scripts/node_modules:
	cd scripts && npm install && npx playwright install chromium

# Start the server, run the suite against it, then tear the server down.
verify: libs scripts/node_modules
	@uv run python -m http.server $(PORT) > /tmp/dd-server.log 2>&1 & \
	SERVER_PID=$$!; \
	sleep 1.5; \
	node scripts/verify.cjs http://localhost:$(PORT); \
	STATUS=$$?; \
	kill $$SERVER_PID 2>/dev/null; \
	exit $$STATUS

# Regenerate the repo screenshots in docs/ (seeds demo data in a headless browser).
screenshots: libs scripts/node_modules
	@uv run python -m http.server $(PORT) > /tmp/dd-server.log 2>&1 & \
	SERVER_PID=$$!; \
	sleep 1.5; \
	node scripts/screenshots.cjs http://localhost:$(PORT); \
	STATUS=$$?; \
	kill $$SERVER_PID 2>/dev/null; \
	exit $$STATUS

# Remove the vendored QR libraries (re-fetched by `make install`).
clean:
	rm -f qrcodegen.js jsQR.js

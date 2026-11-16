# Deploy Handsay on Vultr Compute

This is a prepared deployment procedure, not evidence of an actual deployment. No cloud instance has been created and no cloud account has been charged by this task. The Docker configuration has not been run on Vultr here.

## Prerequisites

- An authorized Vultr account with credits/budget and a Linux Compute instance.
- Docker Engine and Compose available on that instance, installed using Docker's current official instructions.
- A domain/subdomain pointing at the instance, with HTTP/HTTPS reachability. Webcam access requires HTTPS outside localhost.
- An owner-approved public repository containing this source, with third-party notices preserved. Confirm hackathon rules allow the credited existing model/code before submitting.

## Deploy

Copy or clone the project into a directory on the instance. Keep server keys, cloud credentials and private files out of the repository. In that project directory, set the public domain and run:

```sh
export HANDSAY_DOMAIN=handsay.your-domain.example
docker compose up --build -d
docker compose ps
curl -fsS https://$HANDSAY_DOMAIN/api/health
```

Replace the example domain with your actual DNS name. Caddy requests the HTTPS certificate and forwards requests to the app container. Caddy is the only publicly exposed container; the Node backend stays on the internal Compose network. The app is one process with in-memory rooms: do not scale it to multiple replicas without a shared store. A restart clears rooms.

The build runs `npm ci --ignore-scripts`, fetches model assets from pinned sources with integrity verification, and builds Vite. Runtime uses Node's built-in HTTP server and the resulting static files. The backend does not need inference API keys or a GPU.

## Verify before submission

1. Open the **public HTTPS URL** on a laptop. Confirm it reports model ready, without browser console errors.
2. Test a recorded sample and verify it is clearly labeled as a recorded sample.
3. Grant the site camera permission yourself; sign supported vocabulary with a fluent signer. Verify framing feedback and corrections. Do not claim real-world accuracy from a sample playback.
4. Confirm a caption with optional speech. Check that speech matches the exact caption.
5. Create a live room and open its link on a second device. Confirm that unconfirmed draft text is absent. Send a typed interviewer question and verify receipt.
6. Record three takes of a personal gesture, reload to check storage, and test it again. Clearly label it a user-defined mapping.
7. Capture the app running on Vultr, an architecture diagram and both views. Record the required demo video and publish the repository with setup instructions.

The server uses per-IP rate limits without trusting forwarded headers. With Caddy, requests share its container IP; this is suitable only for a small demo, not public-scale traffic. Default limits are intentionally conservative. Production work should add trusted-proxy-aware rate limits and operational monitoring.

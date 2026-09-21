# POLAZU local runner

## Run

1. Extract this ZIP to a normal folder.
2. Double-click POLAZU 실행.cmd.
3. The script starts Docker Desktop if needed, creates local database settings, starts MySQL, then opens the Spring backend and Next.js frontend.

Open http://127.0.0.1:3000 if the browser does not open automatically.

## Prerequisites

- Docker Desktop with its engine running
- JDK 21
- Node.js
- Internet access on the first run so Docker, Gradle, or npm can download missing dependencies

## Local addresses

- Frontend: http://127.0.0.1:3000
- Backend: http://127.0.0.1:8080
- MySQL: 127.0.0.1:3307

## Security

The ZIP excludes .env. On first run, POLAZU 실행.cmd creates a new .env containing random local MySQL passwords. Do not commit or share this file.

## Stop

Close the Spring and Next.js command windows, then double-click POLAZU 중지.cmd.

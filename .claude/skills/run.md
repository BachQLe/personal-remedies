---
name: run
description: Start the Vite dev server for the personal-remedies app on localhost
match:
  - run
  - start
  - dev server
  - launch app
---

# Run the app

This is a Vite + React project.

## Steps

1. Run `npm run dev` in the background from the project root (`/Users/bachle/Desktop/personal-remedies`).
2. Read the background task output to confirm the server started and get the URL.
3. The dev server runs at **http://localhost:5173/** by default.
4. Report the URL to the user.

## Notes

- If port 5173 is already in use, Vite will pick the next available port — read the output to get the actual URL.
- To stop the server, kill the background process.

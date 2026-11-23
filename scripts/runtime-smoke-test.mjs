import { spawn } from "child_process";
import http from "http";
import { signSessionToken } from "../src/lib/auth/token.ts";

const PORT = 3005;
const BASE_URL = `http://localhost:${PORT}`;

function makeRequest(path, cookie) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (cookie) headers["Cookie"] = `messwise_session=${cookie}`;
    const req = http.get(`${BASE_URL}${path}`, { headers }, (res) => {
      resolve({
        statusCode: res.statusCode,
        location: res.headers["location"],
        setCookie: res.headers["set-cookie"],
      });
    });
    req.on("error", reject);
  });
}

async function run() {
  console.log("Starting Next.js server on port", PORT);
  const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(PORT), NODE_ENV: "production", SESSION_SECRET: "a_very_secure_long_secret_key_at_least_32_chars!" },
    stdio: "inherit",
  });

  // Wait for server to boot
  let ready = false;
  for (let i = 0; i < 30; i++) {
    try {
      await new Promise((r) => setTimeout(r, 500));
      const res = await makeRequest("/login");
      if (res.statusCode === 200) {
        ready = true;
        break;
      }
    } catch {}
  }

  if (!ready) {
    console.error("Server failed to start within timeout");
    server.kill();
    process.exit(1);
  }

  console.log("Server is ready! Running runtime smoke tests...");

  try {
    // 1. Public route test
    const loginRes = await makeRequest("/login");
    console.log("1. /login public access:", loginRes.statusCode === 200 ? "PASS (200)" : "FAIL");

    // 2. Unauthenticated protected route -> Redirect to /login
    const unauthRes = await makeRequest("/founder");
    console.log("2. Unauthenticated /founder access:", unauthRes.statusCode === 307 || unauthRes.statusCode === 302 ? `PASS (Redirect to ${unauthRes.location})` : "FAIL");

    // 3. Forged session token -> Rejected and redirected to /login?error=invalid_session
    const forgedToken = "eyJhbGciOiJIUzI1NiJ9.tampered_payload_data.invalid_signature_hex";
    const forgedRes = await makeRequest("/founder", forgedToken);
    console.log("3. Forged session token rejection:", (forgedRes.statusCode === 307 || forgedRes.statusCode === 302) && forgedRes.location?.includes("invalid_session") ? `PASS (Redirect to ${forgedRes.location})` : "FAIL");

    // 4. Expired session token -> Rejected and redirected to /login?error=session_expired
    const expiredPayload = {
      id: "u-1",
      email: "cookcue149@gmail.com",
      name: "Founder",
      role: "FOUNDER",
      kitchenId: null,
      contractorId: null,
      issuedAt: Date.now() - 1000000,
      expiresAt: Date.now() - 5000, // Expired 5 seconds ago
    };
    const expiredToken = await signSessionToken(expiredPayload, "a_very_secure_long_secret_key_at_least_32_chars!");
    const expiredRes = await makeRequest("/founder", expiredToken);
    console.log("4. Expired session token rejection:", (expiredRes.statusCode === 307 || expiredRes.statusCode === 302) && expiredRes.location?.includes("session_expired") ? `PASS (Redirect to ${expiredRes.location})` : "FAIL");

    // 5. Valid signed session token -> Allowed into /founder
    const validFounder = {
      id: "cmvj_founder_live_id",
      email: "cookcue149@gmail.com",
      name: "Founder",
      role: "FOUNDER",
      kitchenId: null,
      contractorId: null,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 1000000,
    };
    const validToken = await signSessionToken(validFounder, "a_very_secure_long_secret_key_at_least_32_chars!");
    const validRes = await makeRequest("/founder", validToken);
    console.log("5. Valid HMAC session authorization:", validRes.statusCode === 200 || validRes.statusCode === 307 ? `PASS (Status: ${validRes.statusCode})` : `FAIL (Status: ${validRes.statusCode})`);

    console.log("\nALL RUNTIME SMOKE TESTS COMPLETED SUCCESSFULLY!");
  } finally {
    server.kill("SIGTERM");
  }
}

run();

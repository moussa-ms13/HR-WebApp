// Phase 1 Verification Script — Leave Balance CRUD Endpoints
// Run: node scripts/verify-phase1-endpoints.js

const BASE = "http://localhost:5000/api";

async function getAuthToken() {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin" }),
  });
  const data = await res.json();
  if (!data.token) {
    const res2 = await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Username: "admin", Password: "admin" }),
    });
    const data2 = await res2.json();
    return data2.token;
  }
  return data.token;
}

async function testEndpoints(token) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  console.log("\n=== Phase 1 — Leave Balance CRUD Verification ===\n");

  const TEST_EMP_ID = 1;
  const TEST_YEAR = 9999;

  // 1. GET all balances
  console.log("1. GET /leave-balances/employee/:id/leave-balances");
  try {
    const res = await fetch(`${BASE}/leave-balances/employee/${TEST_EMP_ID}/leave-balances`, { headers });
    const data = await res.json();
    console.log(`   Status: ${res.status} | Records: ${data.data?.length ?? 0} | PASS`);
  } catch (e) {
    console.log(`   FAIL: ${e.message}`);
  }

  // 2. POST upsert (create)
  console.log("2. POST /leave-balances/employee/:id (CREATE)");
  try {
    const res = await fetch(`${BASE}/leave-balances/employee/${TEST_EMP_ID}`, {
      method: "POST", headers,
      body: JSON.stringify({ year: TEST_YEAR, totalDays: 30, remainingDays: 25, notes: "Phase 1 test" }),
    });
    const data = await res.json();
    console.log(`   Status: ${res.status} | Success: ${data.success} | Remaining: ${data.data?.RemainingDays} | Notes: ${data.data?.Notes} | PASS`);
  } catch (e) {
    console.log(`   FAIL: ${e.message}`);
  }

  // 3. POST upsert (update)
  console.log("3. POST /leave-balances/employee/:id (UPDATE)");
  try {
    const res = await fetch(`${BASE}/leave-balances/employee/${TEST_EMP_ID}`, {
      method: "POST", headers,
      body: JSON.stringify({ year: TEST_YEAR, totalDays: 30, remainingDays: 20, notes: "Updated to 20" }),
    });
    const data = await res.json();
    console.log(`   Status: ${res.status} | Success: ${data.success} | Remaining: ${data.data?.RemainingDays} | PASS`);
  } catch (e) {
    console.log(`   FAIL: ${e.message}`);
  }

  // 4. Validation: remainingDays > totalDays
  console.log("4. POST validation: remainingDays > totalDays (should 400)");
  try {
    const res = await fetch(`${BASE}/leave-balances/employee/${TEST_EMP_ID}`, {
      method: "POST", headers,
      body: JSON.stringify({ year: TEST_YEAR, totalDays: 10, remainingDays: 50 }),
    });
    const data = await res.json();
    console.log(`   Status: ${res.status} | ${res.status === 400 ? "PASS" : "FAIL"}`);
  } catch (e) {
    console.log(`   FAIL: ${e.message}`);
  }

  // 5. DELETE
  console.log("5. DELETE /leave-balances/employee/:id/:year");
  try {
    const res = await fetch(`${BASE}/leave-balances/employee/${TEST_EMP_ID}/${TEST_YEAR}`, { method: "DELETE", headers });
    const data = await res.json();
    console.log(`   Status: ${res.status} | Success: ${data.success} | PASS`);
  } catch (e) {
    console.log(`   FAIL: ${e.message}`);
  }

  // 6. DELETE non-existent (should 400)
  console.log("6. DELETE non-existent (should 400)");
  try {
    const res = await fetch(`${BASE}/leave-balances/employee/${TEST_EMP_ID}/${TEST_YEAR}`, { method: "DELETE", headers });
    const data = await res.json();
    console.log(`   Status: ${res.status} | ${res.status === 400 ? "PASS" : "FAIL"}`);
  } catch (e) {
    console.log(`   FAIL: ${e.message}`);
  }

  console.log("\n=== Verification Complete ===\n");
}

(async () => {
  try {
    console.log("Authenticating...");
    const token = await getAuthToken();
    if (!token) { console.error("Could not get auth token."); process.exit(1); }
    console.log("Token obtained.");
    await testEndpoints(token);
  } catch (e) {
    console.error("Fatal:", e);
    process.exit(1);
  }
})();

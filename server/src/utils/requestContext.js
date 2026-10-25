// ============================================================
// requestContext.js — Fast Non-Blocking Request Context
// Captures client IP in 0ms without LAN DNS reverse timeouts.
// ============================================================
const { AsyncLocalStorage } = require("async_hooks");
const os = require("os");

const asyncLocalStorage = new AsyncLocalStorage();

let cachedServerLanIp = null;

/**
 * Detects the server's actual LAN IPv4 address (e.g. 10.128.21.97).
 * Caches the result in memory for 0ms lookup.
 * @returns {string}
 */
function getServerLanIp() {
  if (cachedServerLanIp) return cachedServerLanIp;
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const net of interfaces[name]) {
        if (net.family === "IPv4" && !net.internal) {
          cachedServerLanIp = net.address;
          return cachedServerLanIp;
        }
      }
    }
  } catch (_) {}
  cachedServerLanIp = "127.0.0.1";
  return cachedServerLanIp;
}

/**
 * Strips IPv6 prefixes, ports (:port), and maps localhost/loopback to the server LAN IP.
 * @param {string} rawIp
 * @returns {string}
 */
function normalizeIp(rawIp) {
  if (!rawIp || typeof rawIp !== "string") return "";

  let ip = rawIp.trim();

  // Strip IPv6-mapped IPv4 prefix (e.g. ::ffff:10.128.21.213:59049 -> 10.128.21.213:59049)
  if (ip.startsWith("::ffff:")) {
    ip = ip.replace(/^::ffff:/i, "");
  }

  // Strip port from IPv4 address (e.g. 10.128.21.213:59049 -> 10.128.21.213)
  const ipv4Match = ip.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?::\d+)?$/);
  if (ipv4Match) {
    ip = ipv4Match[1];
  } else if (ip.startsWith("[") && ip.includes("]:")) {
    // IPv6 with port [::1]:59049
    ip = ip.replace(/^\[([^\]]+)\](?::\d+)?$/, "$1");
  }

  // Map localhost / loopback to the server's real LAN IPv4
  if (ip === "::1" || ip === "127.0.0.1" || ip === "localhost") {
    ip = getServerLanIp();
  }

  return ip;
}

/**
 * Extracts and normalizes the client's real IP address from the request.
 * @param {import('express').Request} req
 * @returns {string}
 */
function extractClientIp(req) {
  if (!req) return "";

  const forwarded = req.headers ? req.headers["x-forwarded-for"] : null;
  let rawIp = "";
  if (typeof forwarded === "string" && forwarded.trim()) {
    rawIp = forwarded.split(",")[0].trim();
  } else if (req.ip) {
    rawIp = req.ip;
  } else if (req.socket && req.socket.remoteAddress) {
    rawIp = req.socket.remoteAddress;
  }

  return normalizeIp(rawIp);
}

/**
 * Resolves an IP address to a client device identifier in 0ms.
 * Fast, deterministic mapping that avoids blocking libuv threadpool on LAN PTR lookups.
 * @param {string} ip
 * @returns {string}
 */
function resolveDeviceName(ip) {
  if (!ip) {
    return getServerLanIp() || os.hostname();
  }
  const cleanIp = normalizeIp(ip);
  return cleanIp || getServerLanIp() || os.hostname();
}

/**
 * Express middleware that initializes the single request context per HTTP request.
 */
function requestContextMiddleware(req, _res, next) {
  const clientIp = extractClientIp(req);
  const userAgent = (req.headers && req.headers["user-agent"]) || "";

  req.clientIp = clientIp;

  const store = {
    clientIp,
    userAgent,
    user: null,
  };

  asyncLocalStorage.run(store, () => next());
}

/**
 * Retrieves the device name for the active request (0ms).
 * @param {string} [explicitIp]
 * @returns {string}
 */
function getClientDeviceName(explicitIp = null) {
  const ip = explicitIp || getClientIp();
  return resolveDeviceName(ip);
}

/**
 * Retrieves the client IP for the active request.
 * @returns {string}
 */
function getClientIp() {
  const store = asyncLocalStorage.getStore();
  return store?.clientIp || "";
}

/**
 * Attaches the authenticated user to the current request store without nesting asyncLocalStorage.run.
 * @param {object} user
 */
function attachUserToContext(user) {
  const store = asyncLocalStorage.getStore();
  if (store) {
    store.user = user;
  }
}

module.exports = {
  asyncLocalStorage,
  requestContextMiddleware,
  getClientDeviceName,
  getClientIp,
  extractClientIp,
  normalizeIp,
  getServerLanIp,
  resolveDeviceName,
  attachUserToContext,
};

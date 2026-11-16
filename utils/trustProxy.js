// NODE_TEAMSYNC_TRUST_PROXY -> Express "trust proxy". Unset, empty or "false" keeps it off,
// so req.ip is the direct peer. "true" trusts every proxy, a number trusts that many hops,
// and anything else (e.g. "loopback" or "10.0.0.0/8, 127.0.0.1") is passed to Express as-is.
const parseTrustProxy = (raw) => {
  const value = String(raw ?? "").trim();
  if (value === "" || value.toLowerCase() === "false") return false;
  if (value.toLowerCase() === "true") return true;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
};

module.exports = { parseTrustProxy };

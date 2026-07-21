import { useState } from "react";
import { ethers } from "ethers";
import { factoryAbi } from "../abi/factoryAbi";
import { deadMansSwitchAbi } from "../abi/deadMansSwitchAbi";
import { getSepoliaProvider, contractExists, friendlyError } from "../utils/network";

const FACTORY = "0xd35cd07d5da21fd3be64f129037b3e0864636ea5";

const STATUS_LABELS = ["Active", "Grace Period", "Triggered", "Cancelled"];
const STATUS_COLORS = { 0: "#0f766e", 1: "#b45309", 2: "#dc2626", 3: "#475569" };

function formatSeconds(secs) {
  const s = Number(secs);
  if (!s || s < 0) return "—";
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${(s / 3600).toFixed(1)}h`;
  return `${(s / 86400).toFixed(1)}d`;
}

function formatDuration(secs) {
  if (secs <= 0) return "Now";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${h}h ${m}m ${s}s`;
}

export default function FactoryPanel() {
  const [checkInInterval, setCheckInInterval] = useState("3600");
  const [grace, setGrace] = useState("1800");
  const [switches, setSwitches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("info");

  function showMsg(text, type = "info") {
    setMsg(text);
    setMsgType(type);
  }

  async function loadSwitches() {
    setLoading(true);
    showMsg("Checking network…");

    try {
      const provider = await getSepoliaProvider();

      const factoryExists = await contractExists(provider, FACTORY);
      if (!factoryExists) {
        showMsg(
          `Factory contract not found at ${FACTORY} on Sepolia. `,
          "error"
        );
        setLoading(false);
        return;
      }

      const signer = await provider.getSigner();
      const wallet = await signer.getAddress();
      showMsg("Loading your switches…");

      const factory = new ethers.Contract(FACTORY, factoryAbi, provider);
      const result = await factory.getSwitchesByOwner(wallet);

      if (result.length === 0) {
        setSwitches([]);
        showMsg("No switches found for this wallet. Deploy one below.", "info");
        setLoading(false);
        return;
      }

      const details = await Promise.all(
        result.map(async (addr) => {
          try {
            const exists = await contractExists(provider, addr);
            if (!exists) return { address: addr, error: "Contract not found on chain" };

            const c = new ethers.Contract(addr, deadMansSwitchAbi, provider);
            const [st, lci, ci, gp, bal] = await Promise.all([
              c.status(),
              c.lastCheckIn(),
              c.checkInInterval(),
              c.gracePeriod(),
              c.currentEthBalance(),
            ]);

            const now = Math.floor(Date.now() / 1000);
            const deadline = Number(lci) + Number(ci);
            const claimable = deadline + Number(gp);
            let timeInfo = "";
            const stNum = Number(st);

            if (stNum === 0) {
              const diff = deadline - now;
              timeInfo = diff > 0
                ? "Next check-in in: " + formatDuration(diff)
                : "Overdue! Anyone can trigger grace period.";
            } else if (stNum === 1) {
              const diff = claimable - now;
              timeInfo = diff > 0
                ? "Grace ends in: " + formatDuration(diff)
                : "Grace expired — beneficiaries can claim.";
            } else if (stNum === 2) {
              timeInfo = "Funds distributed to beneficiaries.";
            } else {
              timeInfo = "Switch cancelled.";
            }

            return {
              address: addr,
              status: stNum,
              checkInInterval: Number(ci),
              gracePeriod: Number(gp),
              ethBalance: ethers.formatEther(bal),
              timeInfo,
              error: null,
            };
          } catch (err) {
            return { address: addr, error: friendlyError(err) };
          }
        })
      );

      setSwitches(details);
      showMsg(`Found ${details.length} switch${details.length !== 1 ? "es" : ""}.`, "success");
    } catch (err) {
      showMsg(friendlyError(err), "error");
    }
    setLoading(false);
  }

  async function deploySwitch() {
    const ci = parseInt(checkInInterval);
    const gp = parseInt(grace);
    if (!ci || ci <= 0 || !gp || gp <= 0) {
      showMsg("Enter valid positive numbers for both fields.", "error");
      return;
    }
    setLoading(true);
    showMsg("Checking network…");

    try {
      const provider = await getSepoliaProvider();
      const factoryExists = await contractExists(provider, FACTORY);
      if (!factoryExists) {
        showMsg(
          `Factory not found at ${FACTORY} on Sepolia. Update FACTORY in FactoryPanel.jsx line 9.`,
          "error"
        );
        setLoading(false);
        return;
      }

      const signer = await provider.getSigner();
      const factory = new ethers.Contract(FACTORY, factoryAbi, signer);
      showMsg("Confirm the transaction in MetaMask…");
      const tx = await factory.createSwitch(ci, gp);
      showMsg("Deploying… waiting for confirmation.");
      const receipt = await tx.wait();
      showMsg(` Switch deployed! Tx: ${receipt.hash}`, "success");
      await loadSwitches();
    } catch (err) {
      showMsg(friendlyError(err), "error");
    }
    setLoading(false);
  }

  const msgBg = { error: "#450a0a", success: "#052e16", info: "#0f172a" };
  const msgColor = { error: "#f87171", success: "#86efac", info: "#93c5fd" };

  return (
    <div className="panel">
      <h2> Factory Panel</h2>
      <p style={{ color: "#94a3b8", marginBottom: "16px", fontSize: "0.9rem" }}>
        Deploy a new Dead Man's Switch on Sepolia.
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
        <span style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "999px", padding: "4px 12px", fontSize: "0.75rem", color: "#60a5fa" }}>
           Sepolia Testnet (11155111)
        </span>
        <span style={{ fontSize: "0.75rem", color: "#475569" }}>
          Factory: {FACTORY.slice(0, 8)}…{FACTORY.slice(-6)}
        </span>
      </div>

      <label>
        Check-in Interval (seconds) — <span style={{ color: "#60a5fa" }}>{formatSeconds(checkInInterval)}</span>
      </label>
      <input type="number" min="1" placeholder="e.g. 3600 = 1 hour" value={checkInInterval} onChange={(e) => setCheckInInterval(e.target.value)} />

      <label style={{ marginTop: "12px" }}>
        Grace Period (seconds) — <span style={{ color: "#60a5fa" }}>{formatSeconds(grace)}</span>
      </label>
      <input type="number" min="1" placeholder="e.g. 1800 = 30 minutes" value={grace} onChange={(e) => setGrace(e.target.value)} />

      <div style={{ marginTop: "14px" }}>
        <button onClick={deploySwitch} disabled={loading}> Deploy Switch</button>
        <button onClick={loadSwitches} disabled={loading} style={{ background: "#1e3a5f" }}> Load My Switches</button>
      </div>

      {msg && (
        <div style={{ marginTop: "12px", padding: "12px", background: msgBg[msgType], borderRadius: "8px", color: msgColor[msgType], fontSize: "0.9rem", wordBreak: "break-all", border: `1px solid ${msgColor[msgType]}33` }}>
          {msg}
        </div>
      )}

      <h3 style={{ marginTop: "24px" }}>My Switches</h3>

      {switches.length === 0 ? (
        <p style={{ color: "#475569", marginTop: "8px", fontSize: "0.9rem" }}>
          Click "Load My Switches" after connecting MetaMask on Sepolia.
        </p>
      ) : (
        switches.map((sw, i) => (
          <div key={i} style={{ background: "#0f172a", borderRadius: "10px", padding: "14px", marginTop: "10px", borderLeft: `4px solid ${sw.error ? "#7f1d1d" : STATUS_COLORS[sw.status] || "#475569"}` }}>
            {sw.error ? (
              <>
                <p style={{ color: "#f87171", fontSize: "0.85rem" }}>{sw.error}</p>
                <p style={{ fontSize: "0.75rem", color: "#64748b", wordBreak: "break-all" }}>{sw.address}</p>
              </>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
                  <span style={{ fontSize: "0.75rem", background: STATUS_COLORS[sw.status], padding: "2px 10px", borderRadius: "999px", fontWeight: "bold" }}>{STATUS_LABELS[sw.status]}</span>
                  <span style={{ color: "#60a5fa", fontSize: "0.85rem" }}>{sw.ethBalance} ETH</span>
                </div>
                <p style={{ fontSize: "0.75rem", color: "#64748b", wordBreak: "break-all", marginTop: "6px" }}>{sw.address}</p>
                <p style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "4px" }}>
                  Interval: {formatSeconds(sw.checkInInterval)} · Grace: {formatSeconds(sw.gracePeriod)}
                </p>
                <p style={{ fontSize: "0.8rem", color: "#fbbf24", marginTop: "4px" }}>⏱ {sw.timeInfo}</p>
                <button style={{ marginTop: "8px", padding: "6px 12px", fontSize: "0.8rem", background: "#1e3a5f" }} onClick={() => { navigator.clipboard.writeText(sw.address); showMsg("Copied: " + sw.address, "success"); }}>
                   Copy Address
                </button>
              </>
            )}
          </div>
        ))
      )}
    </div>
  );
}
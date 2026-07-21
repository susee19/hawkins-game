import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { deadMansSwitchAbi } from "../abi/deadMansSwitchAbi";
import { getSepoliaProvider, contractExists, friendlyError } from "../utils/network";

const STATUS_LABELS = ["Active", "Grace Period", "Triggered", "Cancelled"];
const STATUS_COLORS = ["#0f766e", "#b45309", "#dc2626", "#475569"];

function formatDuration(secs) {
  if (secs <= 0) return "Now";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${h}h ${m}m ${s}s`;
}

function InfoCard({ label, value }) {
  return (
    <div style={{ background: "#0f172a", borderRadius: "8px", padding: "12px", textAlign: "center" }}>
      <div style={{ color: "#64748b", fontSize: "0.75rem", marginBottom: "4px" }}>{label}</div>
      <div style={{ color: "#e2e8f0", fontWeight: "bold", fontSize: "0.95rem" }}>{value}</div>
    </div>
  );
}

export default function BeneficiaryPanel() {
  const [contractAddress, setContractAddress] = useState("");
  const [status, setStatus] = useState(null);
  const [share, setShare] = useState(null);
  const [estimatedETH, setEstimatedETH] = useState(null);
  const [claimable, setClaimable] = useState(false);
  const [claimableTimestamp, setClaimableTimestamp] = useState(null);
  const [countdown, setCountdown] = useState("");
  const [walletAddr, setWalletAddr] = useState("");
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("info");
  const [loading, setLoading] = useState(false);

  function showMsg(text, type = "info") {
    setMsg(text);
    setMsgType(type);
  }

  const loadDetails = useCallback(async () => {
    if (!contractAddress || !ethers.isAddress(contractAddress)) {
      showMsg("Enter a valid 0x… contract address.", "error");
      return;
    }
    showMsg("Checking network…");

    try {
      const provider = await getSepoliaProvider();

      const exists = await contractExists(provider, contractAddress);
      if (!exists) {
        showMsg(
          `No contract found at ${contractAddress} on Sepolia. ` +
            `Make sure MetaMask is on Sepolia and the address is correct.`,
          "error"
        );
        setStatus(null);
        return;
      }

      const signer = await provider.getSigner();
      const userAddr = await signer.getAddress();
      setWalletAddr(userAddr);

      const contract = new ethers.Contract(contractAddress, deadMansSwitchAbi, provider);

      const [st, lci, ci, gp, ethBal] = await Promise.all([
        contract.status(),
        contract.lastCheckIn(),
        contract.checkInInterval(),
        contract.gracePeriod(),
        contract.currentEthBalance(),
      ]);

      const statusNum = Number(st);
      setStatus(statusNum);

      const isBen = await contract.isBeneficiary(userAddr);
      if (isBen) {
        const userShare = await contract.shareOf(userAddr);
        const shareNum = Number(userShare);
        setShare(shareNum);
        const ethBalFloat = parseFloat(ethers.formatEther(ethBal));
        setEstimatedETH(((ethBalFloat * shareNum) / 100).toFixed(6));
      } else {
        setShare(0);
        setEstimatedETH("0");
      }

      const now = Math.floor(Date.now() / 1000);
      const claimAt = Number(lci) + Number(ci) + Number(gp);
      setClaimableTimestamp(claimAt);

      const isClaimable = (statusNum === 1 || statusNum === 2) && now >= claimAt;
      setClaimable(isClaimable);

      showMsg(
        isBen
          ? ` You are a beneficiary of this switch.`
          : `Connected wallet (${userAddr.slice(0, 6)}…${userAddr.slice(-4)}) is not a beneficiary.`,
        isBen ? "success" : "info"
      );
    } catch (err) {
      showMsg(friendlyError(err), "error");
    }
  }, [contractAddress]);

  useEffect(() => {
    if (claimableTimestamp === null) return;
    function tick() {
      const now = Math.floor(Date.now() / 1000);
      const diff = claimableTimestamp - now;
      if (diff <= 0) {
        setCountdown("Claimable now!");
        if (status === 1 || status === 2) setClaimable(true);
      } else {
        setCountdown("Claimable in: " + formatDuration(diff));
      }
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [claimableTimestamp, status]);

  async function claimFunds() {
    setLoading(true);
    showMsg("Confirm in MetaMask…");
    try {
      const provider = await getSepoliaProvider();
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, deadMansSwitchAbi, signer);
      const tx = await contract.claim();
      showMsg("Claim submitted, waiting for confirmation…");
      await tx.wait();
      showMsg("Claim successful! Funds sent to your wallet.", "success");
      setClaimable(false);
    } catch (err) {
      showMsg(friendlyError(err), "error");
    }
    setLoading(false);
  }

  const msgBg = { error: "#450a0a", success: "#052e16", info: "#0f172a" };
  const msgColor = { error: "#f87171", success: "#86efac", info: "#93c5fd" };

  return (
    <div className="panel">
      <h2> Beneficiary Panel</h2>
      <p style={{ color: "#94a3b8", marginBottom: "16px", fontSize: "0.9rem" }}>
        Enter a switch address to check if your connected wallet can claim.
      </p>

      <input
        type="text"
        placeholder="Switch contract address (0x…)"
        value={contractAddress}
        onChange={(e) => { setContractAddress(e.target.value); setStatus(null); setMsg(""); }}
      />
      <button onClick={loadDetails} disabled={loading} style={{ marginTop: "10px" }}>
         Load Contract
      </button>

      {walletAddr && (
        <p style={{ fontSize: "0.8rem", color: "#475569", marginTop: "8px" }}>
          Connected: {walletAddr.slice(0, 6)}…{walletAddr.slice(-4)}
        </p>
      )}

      {status !== null && (
        <div className="status-box" style={{ background: STATUS_COLORS[status], marginTop: "14px" }}>
          Contract Status: <strong>{STATUS_LABELS[status]}</strong>
        </div>
      )}

      {share !== null && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "14px" }}>
          <InfoCard label="Your Share" value={share > 0 ? `${share}%` : "Not a beneficiary"} />
          <InfoCard label="Est. ETH Value" value={estimatedETH !== null ? `${estimatedETH} ETH` : "—"} />
          <InfoCard label="Claimable" value={claimable ? " Yes" : " Not yet"} />
          <InfoCard label="Time Until Claim" value={countdown || "—"} />
        </div>
      )}

      {share !== null && (
        <button
          onClick={claimFunds}
          disabled={!claimable || loading || share === 0}
          style={{
            marginTop: "16px",
            background: claimable && share > 0 ? "#065f46" : "#1e293b",
            cursor: claimable && share > 0 ? "pointer" : "not-allowed",
            width: "100%",
            fontSize: "1.05rem",
            padding: "14px",
          }}
        >
          {loading ? "Processing…" : " Claim Funds"}
        </button>
      )}

      {share === 0 && status !== null && (
        <p style={{ color: "#64748b", fontSize: "0.85rem", marginTop: "8px" }}>
          Your connected wallet is not listed as a beneficiary on this switch.
        </p>
      )}

      {!claimable && share > 0 && status !== null && (
        <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: "8px" }}>
          {status === 0 && "Switch is Active — owner is still checking in."}
          {status === 1 && "Grace period is active. Wait for it to expire."}
          {status === 3 && "Switch was cancelled by the owner."}
        </p>
      )}

      {msg && (
        <div style={{ marginTop: "14px", padding: "12px", background: msgBg[msgType], borderRadius: "8px", color: msgColor[msgType], fontSize: "0.9rem", border: `1px solid ${msgColor[msgType]}33`, wordBreak: "break-all" }}>
          {msg}
        </div>
      )}
    </div>
  );
}


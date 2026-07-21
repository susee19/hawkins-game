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

export default function OwnerPanel() {
  const [wallet, setWallet] = useState("");
  const [switchAddress, setSwitchAddress] = useState("");
  const [status, setStatus] = useState(null);
  const [lastCheckIn, setLastCheckIn] = useState(null);
  const [intervalSecs, setIntervalSecs] = useState(null);
  const [gracePeriod, setGracePeriod] = useState(null);
  const [countdown, setCountdown] = useState("");
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [ethBalance, setEthBalance] = useState("0");
  const [totalShares, setTotalShares] = useState(0);

  const [depositAmount, setDepositAmount] = useState("");
  const [newBeneficiary, setNewBeneficiary] = useState("");
  const [newShare, setNewShare] = useState("");
  const [removeBenAddr, setRemoveBenAddr] = useState("");
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("info");
  const [loading, setLoading] = useState(false);

  function showMsg(text, type = "info") {
    setMsg(text);
    setMsgType(type);
  }

  async function connectWallet() {
    try {
      const provider = await getSepoliaProvider();
      const signer = await provider.getSigner();
      const addr = await signer.getAddress();
      setWallet(addr);
      showMsg("Wallet connected: " + addr, "success");
    } catch (err) {
      showMsg(friendlyError(err), "error");
    }
  }

  const loadContractData = useCallback(async () => {
    if (!switchAddress || !ethers.isAddress(switchAddress)) return;

    try {
      const provider = await getSepoliaProvider();

      const exists = await contractExists(provider, switchAddress);
      if (!exists) {
        showMsg(
          `No contract found at ${switchAddress} on Sepolia. Check the address — it might be on a different network or never deployed.`,
          "error"
        );
        setStatus(null);
        return;
      }

      const contract = new ethers.Contract(switchAddress, deadMansSwitchAbi, provider);

      const [st, lci, ci, gp, ts, bal] = await Promise.all([
        contract.status(),
        contract.lastCheckIn(),
        contract.checkInInterval(),
        contract.gracePeriod(),
        contract.totalShares(),
        contract.currentEthBalance(),
      ]);

      setStatus(Number(st));
      setLastCheckIn(Number(lci));
      setIntervalSecs(Number(ci));
      setGracePeriod(Number(gp));
      setTotalShares(Number(ts));
      setEthBalance(ethers.formatEther(bal));

      const len = await contract.beneficiariesLength();
      const bens = [];
      for (let i = 0; i < Number(len); i++) {
        const [w, s] = await contract.getBeneficiary(i);
        bens.push({ wallet: w, share: Number(s) });
      }
      setBeneficiaries(bens);
      showMsg("Contract loaded.", "success");
    } catch (err) {
      showMsg(friendlyError(err), "error");
    }
  }, [switchAddress]);

 
  useEffect(() => {
    if (lastCheckIn === null || intervalSecs === null || gracePeriod === null) return;
    function tick() {
      const now = Math.floor(Date.now() / 1000);
      const deadline = lastCheckIn + intervalSecs;
      const claimable = deadline + gracePeriod;

      if (status === 0) {
        const diff = deadline - now;
        setCountdown(diff > 0 ? "Next check-in due in: " + formatDuration(diff) : " Check-in overdue!");
      } else if (status === 1) {
        const diff = claimable - now;
        setCountdown(diff > 0 ? "Grace period ends in: " + formatDuration(diff) : " Grace expired!");
      } else if (status === 2) {
        setCountdown("Switch triggered — funds distributed.");
      } else {
        setCountdown("Switch cancelled.");
      }
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastCheckIn, intervalSecs, gracePeriod, status]);

  useEffect(() => {
    if (!switchAddress || !ethers.isAddress(switchAddress)) return;
    loadContractData();
    const id = setInterval(loadContractData, 15000);
    return () => clearInterval(id);
  }, [switchAddress, loadContractData]);

  async function getSignerContract() {
    const provider = await getSepoliaProvider();
    const exists = await contractExists(provider, switchAddress);
    if (!exists) throw new Error(`No contract at ${switchAddress} on Sepolia.`);
    const signer = await provider.getSigner();
    return new ethers.Contract(switchAddress, deadMansSwitchAbi, signer);
  }

  async function checkIn() {
    setLoading(true);
    showMsg("Confirm in MetaMask…");
    try {
      const contract = await getSignerContract();
      const tx = await contract.checkIn();
      showMsg("Submitting check-in…");
      await tx.wait();
      showMsg(" Checked in successfully!", "success");
      await loadContractData();
    } catch (err) {
      showMsg(friendlyError(err), "error");
    }
    setLoading(false);
  }

  async function depositETH() {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      showMsg("Enter a valid ETH amount.", "error");
      return;
    }
    setLoading(true);
    showMsg("Confirm in MetaMask…");
    try {
      const contract = await getSignerContract();
      const value = ethers.parseEther(depositAmount);
      const tx = await contract.deposit(ethers.ZeroAddress, value, { value });
      showMsg("Depositing…");
      await tx.wait();
      showMsg(`Deposited ${depositAmount} ETH!`, "success");
      setDepositAmount("");
      await loadContractData();
    } catch (err) {
      showMsg(friendlyError(err), "error");
    }
    setLoading(false);
  }

  async function addBeneficiary() {
    if (!newBeneficiary || !ethers.isAddress(newBeneficiary)) {
      showMsg("Enter a valid beneficiary address.", "error");
      return;
    }
    if (!newShare || parseInt(newShare) <= 0 || parseInt(newShare) > 100) {
      showMsg("Enter a share between 1 and 100.", "error");
      return;
    }
    setLoading(true);
    showMsg("Confirm in MetaMask…");
    try {
      const contract = await getSignerContract();
      const tx = await contract.addBeneficiary(newBeneficiary, parseInt(newShare));
      showMsg("Adding beneficiary…");
      await tx.wait();
      showMsg(" Beneficiary added!", "success");
      setNewBeneficiary("");
      setNewShare("");
      await loadContractData();
    } catch (err) {
      showMsg(friendlyError(err), "error");
    }
    setLoading(false);
  }

  async function removeBeneficiary() {
    if (!removeBenAddr || !ethers.isAddress(removeBenAddr)) {
      showMsg("Enter a valid address to remove.", "error");
      return;
    }
    setLoading(true);
    showMsg("Confirm in MetaMask…");
    try {
      const contract = await getSignerContract();
      const tx = await contract.removeBeneficiary(removeBenAddr);
      showMsg("Removing…");
      await tx.wait();
      showMsg(" Beneficiary removed!", "success");
      setRemoveBenAddr("");
      await loadContractData();
    } catch (err) {
      showMsg(friendlyError(err), "error");
    }
    setLoading(false);
  }

  async function triggerGracePeriod() {
    setLoading(true);
    showMsg("Confirm in MetaMask…");
    try {
      const contract = await getSignerContract();
      const tx = await contract.triggerGracePeriod();
      showMsg("Triggering grace period…");
      await tx.wait();
      showMsg(" Grace period triggered!", "success");
      await loadContractData();
    } catch (err) {
      showMsg(friendlyError(err), "error");
    }
    setLoading(false);
  }

  async function cancel() {
    if (!cancelConfirm) {
      setCancelConfirm(true);
      showMsg(" This cancels the switch and returns all funds to you. Click 'Confirm Cancel' to proceed.", "info");
      return;
    }
    setLoading(true);
    showMsg("Confirm in MetaMask…");
    try {
      const contract = await getSignerContract();
      const tx = await contract.cancel();
      showMsg("Cancelling…");
      await tx.wait();
      showMsg(" Switch cancelled. Funds returned.", "success");
      setCancelConfirm(false);
      await loadContractData();
    } catch (err) {
      showMsg(friendlyError(err), "error");
      setCancelConfirm(false);
    }
    setLoading(false);
  }

  const isActive = status === 0 || status === 1;
  const msgBg = { error: "#450a0a", success: "#052e16", info: "#0f172a" };
  const msgColor = { error: "#f87171", success: "#86efac", info: "#93c5fd" };

  return (
    <div className="panel">
      <h2> Owner Panel</h2>

      <button onClick={connectWallet}>
        {wallet ? ` ${wallet.slice(0, 6)}…${wallet.slice(-4)}` : "Connect Wallet"}
      </button>
      {wallet && <p className="wallet-address">{wallet}</p>}

      <div style={{ marginTop: "16px" }}>
        <label>Switch Contract Address (Sepolia)</label>
        <input
          placeholder="0x… your deployed switch address"
          value={switchAddress}
          onChange={(e) => { setSwitchAddress(e.target.value); setStatus(null); setMsg(""); }}
        />
        <button onClick={loadContractData} disabled={loading} style={{ marginTop: "10px" }}>
           Load Switch
        </button>
      </div>

      {status !== null && (
        <div className="status-box" style={{ background: STATUS_COLORS[status], marginTop: "16px" }}>
          <div>Status: <strong>{STATUS_LABELS[status]}</strong></div>
          <div style={{ marginTop: "6px", fontSize: "0.9rem" }}>{countdown}</div>
          <div style={{ marginTop: "6px", fontSize: "0.85rem" }}>
            ETH Balance: <strong>{ethBalance} ETH</strong> · Shares Assigned: <strong>{totalShares}%</strong>
          </div>
        </div>
      )}

      {isActive && (
        <div style={{ marginTop: "16px" }}>
          <button onClick={checkIn} disabled={loading}> Check In</button>
        </div>
      )}

      {isActive && (
        <div style={{ marginTop: "16px" }}>
          <label>Deposit ETH</label>
          <input type="number" min="0" step="0.001" placeholder="Amount in ETH (e.g. 0.1)" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
          <button onClick={depositETH} disabled={loading} style={{ marginTop: "8px" }}> Deposit ETH</button>
        </div>
      )}

      {status === 0 && (
        <div style={{ marginTop: "16px" }}>
          <label>Add Beneficiary (total shares must = 100%)</label>
          <input placeholder="Beneficiary wallet address (0x…)" value={newBeneficiary} onChange={(e) => setNewBeneficiary(e.target.value)} />
          <input type="number" min="1" max="100" placeholder={`Share % — currently ${totalShares}% assigned`} value={newShare} onChange={(e) => setNewShare(e.target.value)} style={{ marginTop: "8px" }} />
          <button onClick={addBeneficiary} disabled={loading} style={{ marginTop: "8px" }}> Add Beneficiary</button>
        </div>
      )}

      {beneficiaries.length > 0 && (
        <div style={{ marginTop: "16px" }}>
          <label>Beneficiaries</label>
          {beneficiaries.map((b, i) => (
            <div key={i} style={{ background: "#0f172a", borderRadius: "8px", padding: "8px 12px", marginTop: "6px", fontSize: "0.85rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ wordBreak: "break-all", color: "#94a3b8" }}>{b.wallet}</span>
              <span style={{ marginLeft: "12px", color: "#60a5fa", fontWeight: "bold", whiteSpace: "nowrap" }}>{b.share}%</span>
            </div>
          ))}
        </div>
      )}

      {status === 0 && (
        <div style={{ marginTop: "16px" }}>
          <label>Remove Beneficiary</label>
          <input placeholder="Address to remove" value={removeBenAddr} onChange={(e) => setRemoveBenAddr(e.target.value)} />
          <button onClick={removeBeneficiary} disabled={loading} style={{ marginTop: "8px", background: "#7f1d1d" }}> Remove Beneficiary</button>
        </div>
      )}

      {status === 0 && (
        <div style={{ marginTop: "16px" }}>
          <button onClick={triggerGracePeriod} disabled={loading} style={{ background: "#92400e" }}> Trigger Grace Period</button>
          <span style={{ fontSize: "0.8rem", color: "#64748b", display: "block", marginTop: "4px" }}>Only works if check-in is overdue.</span>
        </div>
      )}

      {isActive && (
        <div style={{ marginTop: "16px" }}>
          <button onClick={cancel} disabled={loading} style={{ background: cancelConfirm ? "#991b1b" : "#7f1d1d" }}>
            {cancelConfirm ? " Confirm Cancel (irreversible)" : " Cancel Switch"}
          </button>
          {cancelConfirm && (
            <button onClick={() => { setCancelConfirm(false); setMsg(""); }} style={{ background: "#334155" }}>Abort</button>
          )}
        </div>
      )}

      {msg && (
        <div style={{ marginTop: "14px", padding: "12px", background: msgBg[msgType], borderRadius: "8px", color: msgColor[msgType], fontSize: "0.9rem", border: `1px solid ${msgColor[msgType]}33`, wordBreak: "break-all" }}>
          {msg}
        </div>
      )}
    </div>
  );
}


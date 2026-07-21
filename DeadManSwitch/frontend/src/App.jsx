import { useEffect, useState } from "react";
import "./App.css";
import FactoryPanel from "./components/FactoryPanel";
import OwnerPanel from "./components/OwnerPanel";
import BeneficiaryPanel from "./components/BeneficiaryPanel";

function App() {
  const [hasMetaMask, setHasMetaMask] = useState(true);

  useEffect(() => {
    if (!window.ethereum) {
      setHasMetaMask(false);
    }
  }, []);

  return (
    <div className="container">
      <h1> Dead Man's Switch</h1>
      <p style={{ textAlign: "center", color: "#64748b", marginBottom: "32px", fontSize: "0.95rem" }}>
        Sepolia Testnet
      </p>

      {!hasMetaMask && (
        <div
          style={{
            background: "#7f1d1d",
            padding: "14px",
            borderRadius: "10px",
            textAlign: "center",
            marginBottom: "20px",
            color: "#fca5a5",
          }}
        >
         MetaMask not detected. Please install MetaMask to use this app.
        </div>
      )}

      <FactoryPanel />
      <OwnerPanel />
      <BeneficiaryPanel />

      <div className="footer">
        <p>Dead Man's Switch · Sepolia Testnet · Built with Foundry + React + ethers.js v6</p>
      </div>
    </div>
  );
}

export default App;
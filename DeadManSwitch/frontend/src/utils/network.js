import { ethers } from "ethers";

export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_CHAIN_HEX = "0xaa36a7";

export async function getSepoliaProvider() {
  if (!window.ethereum) {
    throw new Error("MetaMask not found. Install it from metamask.io");
  }
  const provider = new ethers.BrowserProvider(window.ethereum);
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);

  if (chainId !== SEPOLIA_CHAIN_ID) {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_CHAIN_HEX }],
      });
      return new ethers.BrowserProvider(window.ethereum);
    } catch (switchErr) {
      throw new Error(
        `Wrong network! You are on chain ${chainId}. `
      );
    }
  }

  return provider;
}

export async function contractExists(provider, address) {
  try {
    const code = await provider.getCode(address);
    return code !== "0x" && code !== "0x0";
  } catch {
    return false;
  }
}

export function friendlyError(err) {
  const msg = err?.message || String(err);
  const reason = err?.reason;

  if (reason) return reason;

  if (msg.includes("BAD_DATA") || msg.includes("could not decode")) {
    return "Contract not found at this address on Sepolia. Check the address and make sure MetaMask is on Sepolia.";
  }
  if (msg.includes("user rejected") || msg.includes("User denied")) {
    return "Transaction rejected in MetaMask.";
  }
  if (msg.includes("insufficient funds")) {
    return "Insufficient ETH in your wallet for this transaction.";
  }
  if (msg.includes("nonce")) {
    return "Nonce error — try resetting your MetaMask account (Settings → Advanced → Reset Account).";
  }
  if (msg.includes("network") || msg.includes("chain")) {
    return "Network mismatch. Switch MetaMask to Sepolia and retry.";
  }
  if (msg.includes("execution reverted")) {
    const match = msg.match(/reason="([^"]+)"/);
    return match ? `Contract rejected: ${match[1]}` : "Transaction reverted by contract.";
  }
  return msg.length > 120 ? msg.slice(0, 120) + "…" : msg;
}
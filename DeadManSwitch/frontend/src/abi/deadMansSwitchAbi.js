export const deadMansSwitchAbi = [
  // State-changing functions
  "function checkIn()",
  "function cancel()",
  "function deposit(address token, uint256 amount) payable",
  "function addBeneficiary(address wallet, uint256 share)",
  "function removeBeneficiary(address wallet)",
  "function triggerGracePeriod()",
  "function claim()",

  // View functions
  "function status() view returns (uint8)",
  "function lastCheckIn() view returns (uint256)",
  "function checkInInterval() view returns (uint256)",
  "function gracePeriod() view returns (uint256)",
  "function owner() view returns (address)",
  "function totalShares() view returns (uint256)",
  "function beneficiariesLength() view returns (uint256)",
  "function getBeneficiary(uint256 index) view returns (address wallet, uint256 sharePercent)",
  "function isBeneficiary(address wallet) view returns (bool)",
  "function shareOf(address wallet) view returns (uint256)",
  "function nextDeadline() view returns (uint256)",
  "function claimableAt() view returns (uint256)",
  "function currentEthBalance() view returns (uint256)",
  "function supportedTokensLength() view returns (uint256)",
  "function getSupportedToken(uint256 index) view returns (address token)",

  // Events
  "event CheckedIn(address owner, uint256 timestamp)",
  "event GracePeriodStarted(uint256 deadline)",
  "event SwitchTriggered(uint256 timestamp)",
  "event Cancelled(address owner)",
  "event BeneficiaryClaimed(address beneficiary, uint256 amount)",
];
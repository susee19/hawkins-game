export const factoryAbi = [
  {
    inputs: [
      { internalType: "uint256", name: "checkInInterval", type: "uint256" },
      { internalType: "uint256", name: "gracePeriod", type: "uint256" },
    ],
    name: "createSwitch",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "owner", type: "address" }],
    name: "getSwitchesByOwner",
    outputs: [{ internalType: "address[]", name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "owner", type: "address" },
      { indexed: false, internalType: "address", name: "switchAddress", type: "address" },
    ],
    name: "SwitchCreated",
    type: "event",
  },
];
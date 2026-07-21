// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IDeadMansSwitch {
    enum Status {
        Active,
        GracePeriod,
        Triggered,
        Cancelled
    }

    struct Beneficiary {
        address wallet;
        uint256 sharePercent;
    }

    function deposit(address token, uint256 amount) external payable;
    function checkIn() external;
    function addBeneficiary(address wallet, uint256 share) external;
    function removeBeneficiary(address wallet) external;
    function triggerGracePeriod() external;
    function claim() external;
    function cancel() external;

    function owner() external view returns (address);
    function checkInInterval() external view returns (uint256);
    function gracePeriod() external view returns (uint256);
    function lastCheckIn() external view returns (uint256);
    function status() external view returns (Status);

    function totalShares() external view returns (uint256);
    function beneficiariesLength() external view returns (uint256);
    function getBeneficiary(uint256 index) external view returns (address wallet, uint256 sharePercent);
    function isBeneficiary(address wallet) external view returns (bool);
    function shareOf(address wallet) external view returns (uint256);

    function nextDeadline() external view returns (uint256);
    function claimableAt() external view returns (uint256);

    function currentEthBalance() external view returns (uint256);

    function supportedTokensLength() external view returns (uint256);
    function getSupportedToken(uint256 index) external view returns (address token);
}
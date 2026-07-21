// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IDeadMansSwitch.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract DeadMansSwitch is IDeadMansSwitch, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public owner;
    uint256 public checkInInterval;
    uint256 public gracePeriod;
    uint256 public lastCheckIn;
    Status public status;

    Beneficiary[] private _beneficiaries;
    address[] private _supportedTokens;

    mapping(address => uint256) private _beneficiaryIndexPlusOne;
    mapping(address => bool) private _hasClaimed;
    mapping(address => bool) private _supportedTokenExists;

    bool private _balancesFrozen;
    uint256 private _frozenEthBalance;
    mapping(address => uint256) private _frozenTokenBalances;

    event CheckedIn(address owner, uint256 timestamp);
    event GracePeriodStarted(uint256 deadline);
    event SwitchTriggered(uint256 timestamp);
    event Cancelled(address owner);
    event BeneficiaryClaimed(address beneficiary, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(uint256 _checkInInterval, uint256 _gracePeriod) {
        require(_checkInInterval > 0, "Invalid interval");
        require(_gracePeriod > 0, "Invalid grace period");

        owner = msg.sender;
        checkInInterval = _checkInInterval;
        gracePeriod = _gracePeriod;
        lastCheckIn = block.timestamp;
        status = Status.Active;
    }

    receive() external payable {}

    function deposit(address token, uint256 amount) external payable override onlyOwner {
        require(status != Status.Triggered && status != Status.Cancelled, "Inactive");
        require(amount > 0, "Zero amount");

        if (token == address(0)) {
            require(msg.value == amount, "ETH mismatch");
        } else {
            require(msg.value == 0, "No ETH for token deposit");
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

            if (!_supportedTokenExists[token]) {
                _supportedTokenExists[token] = true;
                _supportedTokens.push(token);
            }
        }
    }

    function checkIn() external override onlyOwner {
        require(status != Status.Cancelled, "Cancelled");

        lastCheckIn = block.timestamp;

        if (status == Status.GracePeriod) {
            status = Status.Active;
        }

        emit CheckedIn(owner, block.timestamp);
    }

    function addBeneficiary(address wallet, uint256 share) external override onlyOwner {
        require(wallet != address(0), "Zero wallet");
        require(share > 0, "Zero share");
        require(status == Status.Active, "Not active");
        require(!isBeneficiary(wallet), "Already beneficiary");
        require(totalShares() + share <= 100, "Shares exceed 100%");

        _beneficiaries.push(Beneficiary({wallet: wallet, sharePercent: share}));
        _beneficiaryIndexPlusOne[wallet] = _beneficiaries.length;
    }

    function removeBeneficiary(address wallet) external override onlyOwner {
        require(status == Status.Active, "Not active");
        uint256 indexPlusOne = _beneficiaryIndexPlusOne[wallet];
        require(indexPlusOne != 0, "Not beneficiary");

        uint256 index = indexPlusOne - 1;
        uint256 lastIndex = _beneficiaries.length - 1;

        if (index != lastIndex) {
            Beneficiary memory lastBeneficiary = _beneficiaries[lastIndex];
            _beneficiaries[index] = lastBeneficiary;
            _beneficiaryIndexPlusOne[lastBeneficiary.wallet] = index + 1;
        }

        _beneficiaries.pop();
        delete _beneficiaryIndexPlusOne[wallet];
    }

    function triggerGracePeriod() external override {
        require(status == Status.Active, "Not active");
        require(block.timestamp > lastCheckIn + checkInInterval, "Check-in not missed");

        status = Status.GracePeriod;
        emit GracePeriodStarted(lastCheckIn + checkInInterval + gracePeriod);
    }

    function claim() external override nonReentrant {
        require(status == Status.GracePeriod || status == Status.Triggered, "Not claimable");
        require(isBeneficiary(msg.sender), "Not beneficiary");
        require(!_hasClaimed[msg.sender], "Already claimed");

        if (status == Status.GracePeriod) {
            require(block.timestamp > lastCheckIn + checkInInterval + gracePeriod, "Grace period active");
            status = Status.Triggered;
            emit SwitchTriggered(block.timestamp);
        }

        if (!_balancesFrozen) {
            _freezeBalances();
        }

        uint256 share = shareOf(msg.sender);
        require(share > 0, "Zero share");

        _hasClaimed[msg.sender] = true;

        uint256 ethAmount = (_frozenEthBalance * share) / 100;
        if (ethAmount > 0) {
            _safeTransferETH(msg.sender, ethAmount);
        }

        for (uint256 i = 0; i < _supportedTokens.length; i++) {
            address token = _supportedTokens[i];
            uint256 tokenAmount = (_frozenTokenBalances[token] * share) / 100;

            if (tokenAmount > 0) {
                IERC20(token).safeTransfer(msg.sender, tokenAmount);
            }
        }

        emit BeneficiaryClaimed(msg.sender, ethAmount);
    }

    function cancel() external override onlyOwner {
        require(status == Status.Active || status == Status.GracePeriod, "Cannot cancel");

        status = Status.Cancelled;

        uint256 ethBalance = address(this).balance;
        if (ethBalance > 0) {
            _safeTransferETH(owner, ethBalance);
        }

        for (uint256 i = 0; i < _supportedTokens.length; i++) {
            address token = _supportedTokens[i];
            uint256 tokenBalance = IERC20(token).balanceOf(address(this));
            if (tokenBalance > 0) {
                IERC20(token).safeTransfer(owner, tokenBalance);
            }
        }

        emit Cancelled(owner);
    }

    function totalShares() public view override returns (uint256) {
        uint256 total;
        for (uint256 i = 0; i < _beneficiaries.length; i++) {
            total += _beneficiaries[i].sharePercent;
        }
        return total;
    }

    function beneficiariesLength() external view override returns (uint256) {
        return _beneficiaries.length;
    }

    function getBeneficiary(uint256 index)
        external
        view
        override
        returns (address wallet, uint256 sharePercent)
    {
        Beneficiary memory b = _beneficiaries[index];
        return (b.wallet, b.sharePercent);
    }

    function isBeneficiary(address wallet) public view override returns (bool) {
        return _beneficiaryIndexPlusOne[wallet] != 0;
    }

    function shareOf(address wallet) public view override returns (uint256) {
        uint256 indexPlusOne = _beneficiaryIndexPlusOne[wallet];
        if (indexPlusOne == 0) return 0;
        return _beneficiaries[indexPlusOne - 1].sharePercent;
    }

    function nextDeadline() public view override returns (uint256) {
        return lastCheckIn + checkInInterval;
    }

    function claimableAt() public view override returns (uint256) {
        return lastCheckIn + checkInInterval + gracePeriod;
    }

    function currentEthBalance() external view override returns (uint256) {
        return address(this).balance;
    }

    function supportedTokensLength() external view override returns (uint256) {
        return _supportedTokens.length;
    }

    function getSupportedToken(uint256 index) external view override returns (address token) {
        return _supportedTokens[index];
    }

    function _freezeBalances() internal {
        _frozenEthBalance = address(this).balance;

        for (uint256 i = 0; i < _supportedTokens.length; i++) {
            address token = _supportedTokens[i];
            _frozenTokenBalances[token] = IERC20(token).balanceOf(address(this));
        }

        _balancesFrozen = true;
    }

    function _safeTransferETH(address to, uint256 amount) internal {
        (bool success, ) = payable(to).call{value: amount}("");
        require(success, "ETH transfer failed");
    }
}
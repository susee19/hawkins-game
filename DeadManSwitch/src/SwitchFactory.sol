// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./DeadMansSwitch.sol";

contract SwitchFactory {
    mapping(address => address[]) public switchesByOwner;

    event SwitchCreated(address indexed owner, address switchAddress);

    function createSwitch(uint256 checkInInterval, uint256 gracePeriod) external {
        DeadMansSwitch newSwitch = new DeadMansSwitch(checkInInterval, gracePeriod);

        switchesByOwner[msg.sender].push(address(newSwitch));

        emit SwitchCreated(msg.sender, address(newSwitch));
    }

    function getSwitchesByOwner(address owner) external view returns (address[] memory) {
        return switchesByOwner[owner];
    }
}
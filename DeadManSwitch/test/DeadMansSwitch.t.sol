// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/DeadMansSwitch.sol";
import "./MockERC20.sol";

contract DeadMansSwitchTest is Test {
    receive() external payable {}

    DeadMansSwitch dms;
    MockERC20 token;

    address beneficiary1 = makeAddr("beneficiary1");
    address beneficiary2 = makeAddr("beneficiary2");

   function setUp() public {
    dms = new DeadMansSwitch(3600, 1800);
    token = new MockERC20();
}

    function _setupBeneficiaries() internal {
        dms.addBeneficiary(beneficiary1, 60);
        dms.addBeneficiary(beneficiary2, 40);
    }

    function testCheckIn() public {
        vm.warp(block.timestamp + 100);

        dms.checkIn();

        assertEq(dms.lastCheckIn(), block.timestamp);
        assertEq(uint256(dms.status()), 0);
    }

    function testTriggerGracePeriod() public {
        vm.warp(block.timestamp + 3601);

        dms.triggerGracePeriod();

        assertEq(uint256(dms.status()), 1);
    }

    function testClaimPaysBeneficiaries() public {
        _setupBeneficiaries();

        vm.deal(address(this), 1 ether);
        dms.deposit{value: 1 ether}(address(0), 1 ether);

        vm.warp(block.timestamp + 3601);
        dms.triggerGracePeriod();

        vm.warp(block.timestamp + 1801);

        uint256 b1Before = beneficiary1.balance;
        uint256 b2Before = beneficiary2.balance;

        vm.prank(beneficiary1);
        dms.claim();

        vm.prank(beneficiary2);
        dms.claim();

        assertEq(beneficiary1.balance, b1Before + 0.6 ether);
        assertEq(beneficiary2.balance, b2Before + 0.4 ether);
        assertEq(uint256(dms.status()), 2);
    }

    function testCancelReturnsFunds() public {
        vm.deal(address(this), 10 ether);

        uint256 beforeBalance = address(this).balance;

        dms.deposit{value: 1 ether}(address(0), 1 ether);

        dms.cancel();

        assertEq(address(this).balance, beforeBalance);
        assertEq(uint256(dms.status()), 3);
    }

    function testAddAndRemoveBeneficiary() public {
        dms.addBeneficiary(beneficiary1, 50);

        assertEq(dms.beneficiariesLength(), 1);
        assertTrue(dms.isBeneficiary(beneficiary1));

        dms.removeBeneficiary(beneficiary1);

        assertEq(dms.beneficiariesLength(), 0);
        assertFalse(dms.isBeneficiary(beneficiary1));
    }

    function testShareValidation() public {
        dms.addBeneficiary(beneficiary1, 60);
        dms.addBeneficiary(beneficiary2, 40);

        vm.expectRevert();
        dms.addBeneficiary(makeAddr("third"), 10);
    }

    function testGracePeriodRecovery() public {
        vm.warp(block.timestamp + 3601);
        dms.triggerGracePeriod();

        assertEq(uint256(dms.status()), 1);

        dms.checkIn();

        assertEq(uint256(dms.status()), 0);
    }

    function testViewFunctions() public {
        dms.addBeneficiary(beneficiary1, 100);

        assertEq(dms.totalShares(), 100);
        assertEq(dms.shareOf(beneficiary1), 100);
        assertTrue(dms.isBeneficiary(beneficiary1));
        assertGt(dms.nextDeadline(), block.timestamp);
        assertGt(dms.claimableAt(), dms.nextDeadline());
    }

    function testCurrentEthBalance() public {
        vm.deal(address(this), 2 ether);

        dms.deposit{value: 1 ether}(address(0), 1 ether);

        assertEq(dms.currentEthBalance(), 1 ether);
    }

    function testCannotClaimTwice() public {
        _setupBeneficiaries();

        vm.deal(address(this), 1 ether);
        dms.deposit{value: 1 ether}(address(0), 1 ether);

        vm.warp(block.timestamp + 3601);
        dms.triggerGracePeriod();

        vm.warp(block.timestamp + 1801);

        vm.prank(beneficiary1);
        dms.claim();

        vm.prank(beneficiary1);
        vm.expectRevert();
        dms.claim();
    }

    function testNonBeneficiaryCannotClaim() public {
        vm.warp(block.timestamp + 3601);
        dms.triggerGracePeriod();

        vm.warp(block.timestamp + 1801);

        vm.expectRevert();
        dms.claim();
    }

    function testCannotTriggerEarly() public {
        vm.expectRevert();
        dms.triggerGracePeriod();
    }

    function testDuplicateBeneficiary() public {
        dms.addBeneficiary(beneficiary1, 50);

        vm.expectRevert();
        dms.addBeneficiary(beneficiary1, 10);
    }

    function testRemoveNonBeneficiary() public {
        vm.expectRevert();
        dms.removeBeneficiary(beneficiary1);
    }

    function testCannotClaimBeforeGraceEnds() public {
        _setupBeneficiaries();

        vm.deal(address(this), 1 ether);
        dms.deposit{value: 1 ether}(address(0), 1 ether);

        vm.warp(block.timestamp + 3601);
        dms.triggerGracePeriod();

        vm.prank(beneficiary1);
        vm.expectRevert();
        dms.claim();
    }
    function testERC20DepositPath() public {
    token.approve(address(dms), 100 ether);

    dms.deposit(address(token), 100 ether);

    assertEq(dms.supportedTokensLength(), 1);
    assertEq(dms.getSupportedToken(0), address(token));
}

function testCancelReturnsERC20() public {
    token.approve(address(dms), 100 ether);

    dms.deposit(address(token), 100 ether);

    uint256 beforeBalance = token.balanceOf(address(this));

    dms.cancel();

    uint256 afterBalance = token.balanceOf(address(this));

    assertEq(afterBalance, beforeBalance + 100 ether);
}

function testShareOfNonBeneficiary() public {
    assertEq(dms.shareOf(beneficiary1), 0);
}

function testIsBeneficiaryFalse() public {
    assertFalse(dms.isBeneficiary(beneficiary1));
}

function testDepositZeroAmountReverts() public {
    vm.expectRevert();
    dms.deposit(address(0), 0);
}

function testCannotAddZeroShare() public {
    vm.expectRevert();
    dms.addBeneficiary(beneficiary1, 0);
}

function testCannotAddZeroAddress() public {
    vm.expectRevert();
    dms.addBeneficiary(address(0), 50);
}

function testCannotRemoveAfterTriggered() public {
    _setupBeneficiaries();

    vm.deal(address(this), 1 ether);

    dms.deposit{value: 1 ether}(address(0), 1 ether);

    vm.warp(block.timestamp + 3601);
    dms.triggerGracePeriod();

    vm.warp(block.timestamp + 1801);

    vm.prank(beneficiary1);
    dms.claim();

    vm.expectRevert();
    dms.removeBeneficiary(beneficiary2);
}
}
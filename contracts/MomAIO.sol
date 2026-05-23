// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MomAIO
 * @notice momment. Attention Intelligence Oracle v0.1 — Hash Registry
 *         Stores provenance hashes for assertions, verifications, and resolutions.
 *         No funds/bonds are handled in this version.
 *         Giwa Sepolia testnet only.
 */
contract MomAIO {
    string public constant VERSION = "0.1";

    address public owner;

    // ─── Structs ────────────────────────────────

    struct AssertionSeal {
        bytes32 assertionHash;   // SHA256(claim_text + asserted_outcome + ...)
        bytes32 ruleHash;        // SHA256(rule question + criteria + outcomes)
        bytes32 evidenceHash;    // SHA256(evidence bundle)
        uint64  timestamp;
        bool    exists;
    }

    struct VerificationSeal {
        bytes32 llmBundleHash;   // SHA256(all LLM verification outputs)
        bytes32 verdict;         // keccak256 of verdict string (e.g., "supports")
        uint16  confidence;      // 0-10000 (basis points, e.g., 9500 = 95.00%)
        uint64  timestamp;
        bool    exists;
    }

    struct ResolutionSeal {
        bytes32 resolutionHash;  // SHA256(final outcome + resolution text + ...)
        bytes32 finalOutcome;    // keccak256 of outcome string
        uint64  timestamp;
        bool    exists;
    }

    // ─── Storage ────────────────────────────────

    mapping(bytes32 => AssertionSeal)     public assertions;
    mapping(bytes32 => VerificationSeal)  public verifications;
    mapping(bytes32 => ResolutionSeal)    public resolutions;

    uint256 public totalAssertions;
    uint256 public totalVerifications;
    uint256 public totalResolutions;

    // ─── Events ─────────────────────────────────

    event AssertionSealed(
        bytes32 indexed assertionId,
        bytes32 assertionHash,
        bytes32 ruleHash,
        bytes32 evidenceHash,
        uint64  timestamp
    );

    event VerificationSealed(
        bytes32 indexed assertionId,
        bytes32 llmBundleHash,
        bytes32 verdict,
        uint16  confidence,
        uint64  timestamp
    );

    event ResolutionSealed(
        bytes32 indexed assertionId,
        bytes32 resolutionHash,
        bytes32 finalOutcome,
        uint64  timestamp
    );

    // ─── Modifiers ──────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "MomAIO: not owner");
        _;
    }

    // ─── Constructor ────────────────────────────

    constructor() {
        owner = msg.sender;
    }

    // ─── Seal Functions ─────────────────────────

    /**
     * @notice Seal an assertion's provenance hashes on-chain.
     * @param assertionId  UUID of the assertion (as bytes32)
     * @param assertionHash Hash of assertion content
     * @param ruleHash      Hash of the attention rule
     * @param evidenceHash  Hash of the evidence bundle
     */
    function sealAssertion(
        bytes32 assertionId,
        bytes32 assertionHash,
        bytes32 ruleHash,
        bytes32 evidenceHash
    ) external onlyOwner {
        require(!assertions[assertionId].exists, "MomAIO: assertion already sealed");

        uint64 ts = uint64(block.timestamp);

        assertions[assertionId] = AssertionSeal({
            assertionHash: assertionHash,
            ruleHash: ruleHash,
            evidenceHash: evidenceHash,
            timestamp: ts,
            exists: true
        });

        totalAssertions++;

        emit AssertionSealed(assertionId, assertionHash, ruleHash, evidenceHash, ts);
    }

    /**
     * @notice Seal LLM verification results on-chain.
     * @param assertionId   UUID of the assertion (as bytes32)
     * @param llmBundleHash Hash of all LLM verification outputs
     * @param verdict       keccak256 of verdict string
     * @param confidence    Confidence in basis points (0-10000)
     */
    function sealVerification(
        bytes32 assertionId,
        bytes32 llmBundleHash,
        bytes32 verdict,
        uint16  confidence
    ) external onlyOwner {
        require(!verifications[assertionId].exists, "MomAIO: verification already sealed");

        uint64 ts = uint64(block.timestamp);

        verifications[assertionId] = VerificationSeal({
            llmBundleHash: llmBundleHash,
            verdict: verdict,
            confidence: confidence,
            timestamp: ts,
            exists: true
        });

        totalVerifications++;

        emit VerificationSealed(assertionId, llmBundleHash, verdict, confidence, ts);
    }

    /**
     * @notice Seal final resolution on-chain.
     * @param assertionId    UUID of the assertion (as bytes32)
     * @param resolutionHash Hash of resolution content
     * @param finalOutcome   keccak256 of outcome string
     */
    function sealResolution(
        bytes32 assertionId,
        bytes32 resolutionHash,
        bytes32 finalOutcome
    ) external onlyOwner {
        require(!resolutions[assertionId].exists, "MomAIO: resolution already sealed");

        uint64 ts = uint64(block.timestamp);

        resolutions[assertionId] = ResolutionSeal({
            resolutionHash: resolutionHash,
            finalOutcome: finalOutcome,
            timestamp: ts,
            exists: true
        });

        totalResolutions++;

        emit ResolutionSealed(assertionId, resolutionHash, finalOutcome, ts);
    }

    // ─── View Functions ─────────────────────────

    function isAssertionSealed(bytes32 assertionId) external view returns (bool) {
        return assertions[assertionId].exists;
    }

    function isVerificationSealed(bytes32 assertionId) external view returns (bool) {
        return verifications[assertionId].exists;
    }

    function isResolutionSealed(bytes32 assertionId) external view returns (bool) {
        return resolutions[assertionId].exists;
    }

    // ─── Admin ──────────────────────────────────

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "MomAIO: zero address");
        owner = newOwner;
    }
}

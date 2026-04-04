// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

library SignatureVerifier {
    function makeSignatureHash(
        address target,
        uint64 expires,
        bytes memory request,
        bytes memory result
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    hex"1900",
                    target,
                    expires,
                    keccak256(request),
                    keccak256(result)
                )
            );
    }

    function verify(
        bytes calldata request,
        bytes calldata response
    ) internal view returns (address, bytes memory) {
        (bytes memory result, uint64 expires, bytes memory sig) = abi.decode(
            response,
            (bytes, uint64, bytes)
        );
        (bytes memory extraData, address sender) = abi.decode(
            request,
            (bytes, address)
        );
        address signer = ECDSA.recover(
            makeSignatureHash(sender, expires, extraData, result),
            sig
        );
        require(
            expires >= block.timestamp,
            "SignatureVerifier: Signature expired"
        );
        return (signer, result);
    }
}

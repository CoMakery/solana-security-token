import { BN, utils } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

export const findDistributorKey = (
  base: PublicKey,
  programId: PublicKey
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [utils.bytes.utf8.encode("MerkleDistributor"), base.toBytes()],
    programId
  );
};

export const findClaimStatusKey = (
  index: BN,
  distributor: PublicKey,
  programId: PublicKey
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [
      utils.bytes.utf8.encode("ClaimStatus"),
      index.toArrayLike(Buffer, "le", 8),
      distributor.toBytes(),
    ],
    programId
  );
};

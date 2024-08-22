/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/dividends.json`.
 */
export type Dividends = {
  address: "BvQwgkeevtxXrUsWtZU3fUu5R3qTYne2XfrQp8dXXut3";
  metadata: {
    name: "dividends";
    version: "0.1.0";
    spec: "0.1.0";
    description: "Dividends are based on Merkle tree distribution";
  };
  instructions: [
    {
      name: "claim";
      docs: ["Claims tokens from the [MerkleDistributor]."];
      discriminator: [62, 198, 214, 193, 213, 159, 108, 210];
      accounts: [
        {
          name: "distributor";
          docs: ["The [MerkleDistributor]."];
          writable: true;
        },
        {
          name: "claimStatus";
          docs: ["Status of the claim."];
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [67, 108, 97, 105, 109, 83, 116, 97, 116, 117, 115];
              },
              {
                kind: "arg";
                path: "index";
              },
              {
                kind: "account";
                path: "distributor";
              }
            ];
          };
        },
        {
          name: "from";
          docs: ["Distributor ATA containing the tokens to distribute."];
          writable: true;
        },
        {
          name: "to";
          docs: ["Account to send the claimed tokens to."];
          writable: true;
        },
        {
          name: "claimant";
          docs: ["Who is claiming the tokens."];
          signer: true;
        },
        {
          name: "payer";
          docs: ["Payer of the claim."];
          writable: true;
          signer: true;
        },
        {
          name: "mint";
        },
        {
          name: "systemProgram";
          docs: ["The [System] program."];
          address: "11111111111111111111111111111111";
        },
        {
          name: "tokenProgram";
          docs: ["SPL [Token] program."];
        }
      ];
      args: [
        {
          name: "bump";
          type: "u8";
        },
        {
          name: "index";
          type: "u64";
        },
        {
          name: "amount";
          type: "u64";
        },
        {
          name: "proof";
          type: {
            vec: {
              array: ["u8", 32];
            };
          };
        }
      ];
    },
    {
      name: "newDistributor";
      docs: [
        "Creates a new [MerkleDistributor].",
        "After creating this [MerkleDistributor], the account should be seeded with tokens via its ATA."
      ];
      discriminator: [32, 139, 112, 171, 0, 2, 225, 155];
      accounts: [
        {
          name: "base";
          docs: ["Base key of the distributor."];
          signer: true;
        },
        {
          name: "distributor";
          docs: ["[MerkleDistributor]."];
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  77,
                  101,
                  114,
                  107,
                  108,
                  101,
                  68,
                  105,
                  115,
                  116,
                  114,
                  105,
                  98,
                  117,
                  116,
                  111,
                  114
                ];
              },
              {
                kind: "account";
                path: "base";
              }
            ];
          };
        },
        {
          name: "mint";
          docs: ["The mint to distribute."];
        },
        {
          name: "payer";
          docs: ["Payer to create the distributor."];
          writable: true;
          signer: true;
        },
        {
          name: "systemProgram";
          docs: ["The [System] program."];
          address: "11111111111111111111111111111111";
        }
      ];
      args: [
        {
          name: "bump";
          type: "u8";
        },
        {
          name: "root";
          type: {
            array: ["u8", 32];
          };
        },
        {
          name: "maxTotalClaim";
          type: "u64";
        },
        {
          name: "maxNumNodes";
          type: "u64";
        }
      ];
    }
  ];
  accounts: [
    {
      name: "claimStatus";
      discriminator: [22, 183, 249, 157, 247, 95, 150, 96];
    },
    {
      name: "merkleDistributor";
      discriminator: [77, 119, 139, 70, 84, 247, 12, 26];
    }
  ];
  events: [
    {
      name: "claimedEvent";
      discriminator: [144, 172, 209, 86, 144, 87, 84, 115];
    }
  ];
  errors: [
    {
      code: 6000;
      name: "invalidProof";
      msg: "Invalid Merkle proof";
    },
    {
      code: 6001;
      name: "dropAlreadyClaimed";
      msg: "Drop already claimed";
    },
    {
      code: 6002;
      name: "exceededMaxClaim";
      msg: "Exceeded maximum claim amount";
    },
    {
      code: 6003;
      name: "exceededMaxNumNodes";
      msg: "Exceeded maximum number of claimed nodes";
    },
    {
      code: 6004;
      name: "unauthorized";
      msg: "Account is not authorized to execute this instruction";
    },
    {
      code: 6005;
      name: "ownerMismatch";
      msg: "Token account owner did not match intended owner";
    },
    {
      code: 6006;
      name: "keysMustNotMatch";
      msg: "Keys must not match";
    }
  ];
  types: [
    {
      name: "claimStatus";
      docs: [
        "Holds whether or not a claimant has claimed tokens.",
        "",
        "TODO: this is probably better stored as the node that was verified."
      ];
      type: {
        kind: "struct";
        fields: [
          {
            name: "isClaimed";
            docs: ["If true, the tokens have been claimed."];
            type: "bool";
          },
          {
            name: "claimant";
            docs: ["Authority that claimed the tokens."];
            type: "pubkey";
          },
          {
            name: "claimedAt";
            docs: ["When the tokens were claimed."];
            type: "i64";
          },
          {
            name: "amount";
            docs: ["Amount of tokens claimed."];
            type: "u64";
          }
        ];
      };
    },
    {
      name: "claimedEvent";
      docs: ["Emitted when tokens are claimed."];
      type: {
        kind: "struct";
        fields: [
          {
            name: "index";
            docs: ["Index of the claim."];
            type: "u64";
          },
          {
            name: "claimant";
            docs: ["User that claimed."];
            type: "pubkey";
          },
          {
            name: "amount";
            docs: ["Amount of tokens to distribute."];
            type: "u64";
          }
        ];
      };
    },
    {
      name: "merkleDistributor";
      docs: ["State for the account which distributes tokens."];
      type: {
        kind: "struct";
        fields: [
          {
            name: "base";
            docs: ["Base key used to generate the PDA."];
            type: "pubkey";
          },
          {
            name: "bump";
            docs: ["Bump seed."];
            type: "u8";
          },
          {
            name: "root";
            docs: ["The 256-bit merkle root."];
            type: {
              array: ["u8", 32];
            };
          },
          {
            name: "mint";
            docs: ["[Mint] of the token to be distributed."];
            type: "pubkey";
          },
          {
            name: "maxTotalClaim";
            docs: [
              "Maximum number of tokens that can ever be claimed from this [MerkleDistributor]."
            ];
            type: "u64";
          },
          {
            name: "maxNumNodes";
            docs: [
              "Maximum number of nodes that can ever be claimed from this [MerkleDistributor]."
            ];
            type: "u64";
          },
          {
            name: "totalAmountClaimed";
            docs: ["Total amount of tokens that have been claimed."];
            type: "u64";
          },
          {
            name: "numNodesClaimed";
            docs: ["Number of nodes that have been claimed."];
            type: "u64";
          }
        ];
      };
    }
  ];
};

/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/transfer_restrictions.json`.
 */
export type TransferRestrictions = {
  "address": "6yEnqdEjX3zBBDkzhwTRGJwv1jRaN4QE4gywmgdcfPBZ",
  "metadata": {
    "name": "transferRestrictions",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Transfer restrictions for Solana tokens"
  },
  "instructions": [
    {
      "name": "executeTransaction",
      "docs": [
        "execute transfer hook"
      ],
      "discriminator": [
        105,
        37,
        101,
        197,
        75,
        251,
        102,
        26
      ],
      "accounts": [
        {
          "name": "sourceAccount"
        },
        {
          "name": "mint"
        },
        {
          "name": "destinationAccount"
        },
        {
          "name": "ownerDelegate"
        },
        {
          "name": "extraMetasAccount",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  120,
                  116,
                  114,
                  97,
                  45,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116,
                  45,
                  109,
                  101,
                  116,
                  97,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "transferRestrictionData"
        },
        {
          "name": "securityAssociatedAccountFrom"
        },
        {
          "name": "securityAssociatedAccountTo"
        },
        {
          "name": "transferRestrictionGroupFrom",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "transferRestrictionData"
              },
              {
                "kind": "account",
                "path": "security_associated_account_from.group",
                "account": "securityAssociatedAccount"
              }
            ]
          }
        },
        {
          "name": "transferRestrictionGroupTo",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "transferRestrictionData"
              },
              {
                "kind": "account",
                "path": "security_associated_account_to.group",
                "account": "securityAssociatedAccount"
              }
            ]
          }
        },
        {
          "name": "transferRule"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initializeExtraAccountMetaList",
      "discriminator": [
        92,
        197,
        174,
        197,
        41,
        124,
        19,
        3
      ],
      "accounts": [
        {
          "name": "extraMetasAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  120,
                  116,
                  114,
                  97,
                  45,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116,
                  45,
                  109,
                  101,
                  116,
                  97,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "securityMint"
              }
            ]
          }
        },
        {
          "name": "securityMint"
        },
        {
          "name": "authorityWalletRole"
        },
        {
          "name": "accessControl"
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initializeSecurityAssociatedAccount",
      "discriminator": [
        154,
        169,
        189,
        28,
        30,
        71,
        161,
        50
      ],
      "accounts": [
        {
          "name": "securityAssociatedAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  97,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "associatedTokenAccount"
              }
            ]
          }
        },
        {
          "name": "group"
        },
        {
          "name": "holder"
        },
        {
          "name": "securityToken"
        },
        {
          "name": "transferRestrictionData",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "securityToken"
              }
            ]
          }
        },
        {
          "name": "userWallet"
        },
        {
          "name": "associatedTokenAccount"
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initializeTransferRestrictionGroup",
      "discriminator": [
        62,
        223,
        111,
        8,
        59,
        225,
        31,
        108
      ],
      "accounts": [
        {
          "name": "transferRestrictionGroup",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "transferRestrictionData"
              },
              {
                "kind": "arg",
                "path": "id"
              }
            ]
          }
        },
        {
          "name": "transferRestrictionData",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "access_control_account.mint",
                "account": "accessControl"
              }
            ]
          }
        },
        {
          "name": "accessControlAccount"
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "id",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initializeTransferRestrictionHolder",
      "discriminator": [
        184,
        97,
        123,
        132,
        240,
        132,
        91,
        118
      ],
      "accounts": [
        {
          "name": "transferRestrictionHolder",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "transferRestrictionData"
              },
              {
                "kind": "arg",
                "path": "id"
              }
            ]
          }
        },
        {
          "name": "transferRestrictionData",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "access_control_account.mint",
                "account": "accessControl"
              }
            ]
          }
        },
        {
          "name": "accessControlAccount"
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "id",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initializeTransferRestrictionsData",
      "discriminator": [
        214,
        241,
        131,
        83,
        138,
        120,
        171,
        133
      ],
      "accounts": [
        {
          "name": "transferRestrictionData",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "accessControlAccount"
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        }
      ],
      "args": [
        {
          "name": "maxHolders",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initializeTransferRule",
      "discriminator": [
        24,
        28,
        16,
        18,
        72,
        26,
        87,
        49
      ],
      "accounts": [
        {
          "name": "transferRule",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "transferRestrictionGroupFrom"
              },
              {
                "kind": "account",
                "path": "transferRestrictionGroupTo"
              }
            ]
          }
        },
        {
          "name": "transferRestrictionData",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "access_control_account.mint",
                "account": "accessControl"
              }
            ]
          }
        },
        {
          "name": "transferRestrictionGroupFrom"
        },
        {
          "name": "transferRestrictionGroupTo"
        },
        {
          "name": "accessControlAccount"
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "lockUntil",
          "type": "u64"
        }
      ]
    },
    {
      "name": "updateWalletGroup",
      "discriminator": [
        225,
        33,
        252,
        93,
        186,
        129,
        24,
        241
      ],
      "accounts": [
        {
          "name": "securityAssociatedAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  97,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "securityToken"
              },
              {
                "kind": "account",
                "path": "userWallet"
              }
            ]
          }
        },
        {
          "name": "securityToken"
        },
        {
          "name": "transferRestrictionData",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "securityToken"
              }
            ]
          }
        },
        {
          "name": "transferRestrictionGroup",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "transferRestrictionData"
              },
              {
                "kind": "account",
                "path": "transfer_restriction_group.id",
                "account": "transferRestrictionGroup"
              }
            ]
          }
        },
        {
          "name": "userWallet"
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "accessControl",
      "discriminator": [
        147,
        81,
        178,
        92,
        223,
        66,
        181,
        132
      ]
    },
    {
      "name": "securityAssociatedAccount",
      "discriminator": [
        68,
        169,
        137,
        56,
        226,
        21,
        69,
        124
      ]
    },
    {
      "name": "transferRestrictionData",
      "discriminator": [
        166,
        184,
        205,
        98,
        165,
        224,
        174,
        148
      ]
    },
    {
      "name": "transferRestrictionGroup",
      "discriminator": [
        61,
        120,
        96,
        96,
        113,
        210,
        205,
        223
      ]
    },
    {
      "name": "transferRestrictionHolder",
      "discriminator": [
        196,
        226,
        112,
        46,
        157,
        122,
        48,
        157
      ]
    },
    {
      "name": "transferRule",
      "discriminator": [
        200,
        231,
        114,
        91,
        84,
        241,
        109,
        172
      ]
    },
    {
      "name": "walletRole",
      "discriminator": [
        219,
        71,
        35,
        217,
        102,
        248,
        173,
        9
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "unauthorized"
    },
    {
      "code": 6001,
      "name": "maxHoldersReached",
      "msg": "Max holders reached"
    },
    {
      "code": 6002,
      "name": "transferRuleLocked",
      "msg": "Transfer rule locked"
    },
    {
      "code": 6003,
      "name": "invalidAuthority",
      "msg": "Invalid authority"
    },
    {
      "code": 6004,
      "name": "invalidRole",
      "msg": "Invalid role"
    }
  ],
  "types": [
    {
      "name": "accessControl",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "securityAssociatedAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "group",
            "type": "u64"
          },
          {
            "name": "holder",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "transferRestrictionData",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "securityTokenMint",
            "type": "pubkey"
          },
          {
            "name": "accessControlAccount",
            "type": "pubkey"
          },
          {
            "name": "currentHoldersCount",
            "type": "u64"
          },
          {
            "name": "maxHolders",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "transferRestrictionGroup",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "id",
            "type": "u64"
          },
          {
            "name": "currentHoldersCount",
            "type": "u64"
          },
          {
            "name": "maxHolders",
            "type": "u64"
          },
          {
            "name": "transferRestrictionData",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "transferRestrictionHolder",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "transferRestrictionData",
            "type": "pubkey"
          },
          {
            "name": "currentWalletsCount",
            "type": "u64"
          },
          {
            "name": "id",
            "type": "u64"
          },
          {
            "name": "active",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "transferRule",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "transferRestrictionData",
            "type": "pubkey"
          },
          {
            "name": "transferGroupIdFrom",
            "type": "u64"
          },
          {
            "name": "transferGroupIdTo",
            "type": "u64"
          },
          {
            "name": "lockedUntil",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "walletRole",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "accessControl",
            "type": "pubkey"
          },
          {
            "name": "role",
            "type": "u8"
          }
        ]
      }
    }
  ]
};

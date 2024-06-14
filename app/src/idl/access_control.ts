/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/access_control.json`.
 */
export type AccessControl = {
  "address": "4X79YRjz9KNMhdjdxXg2ZNTS3YnMGYdwJkBHnezMJwr3",
  "metadata": {
    "name": "accessControl",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Access Control for Solana Programs"
  },
  "instructions": [
    {
      "name": "burnSecurities",
      "discriminator": [
        79,
        165,
        145,
        57,
        203,
        228,
        175,
        0
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "authorityWalletRole",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  97,
                  108,
                  108,
                  101,
                  116,
                  95,
                  114,
                  111,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "securityMint"
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "accessControl",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99
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
          "name": "securityMint",
          "writable": true
        },
        {
          "name": "targetAccount",
          "writable": true
        },
        {
          "name": "targetAuthority"
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
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
      "name": "freezeWallet",
      "discriminator": [
        93,
        202,
        159,
        167,
        22,
        246,
        255,
        211
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "authorityWalletRole",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  97,
                  108,
                  108,
                  101,
                  116,
                  95,
                  114,
                  111,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "securityMint"
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "accessControl",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99
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
          "name": "securityMint",
          "writable": true
        },
        {
          "name": "targetAccount",
          "writable": true
        },
        {
          "name": "targetAuthority"
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        }
      ],
      "args": []
    },
    {
      "name": "initializeAccessControl",
      "discriminator": [
        244,
        90,
        245,
        242,
        199,
        224,
        247,
        140
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "authority"
        },
        {
          "name": "mint",
          "writable": true,
          "signer": true
        },
        {
          "name": "accessControl",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99
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
          "name": "args",
          "type": {
            "defined": {
              "name": "initializeAccessControlArgs"
            }
          }
        }
      ]
    },
    {
      "name": "initializeDeployerRole",
      "discriminator": [
        20,
        92,
        210,
        30,
        61,
        126,
        220,
        36
      ],
      "accounts": [
        {
          "name": "walletRole",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  97,
                  108,
                  108,
                  101,
                  116,
                  95,
                  114,
                  111,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "securityToken"
              },
              {
                "kind": "account",
                "path": "payer"
              }
            ]
          }
        },
        {
          "name": "accessControl",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99
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
          "name": "securityToken"
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
      "name": "initializeWalletRole",
      "discriminator": [
        218,
        166,
        58,
        194,
        218,
        211,
        151,
        175
      ],
      "accounts": [
        {
          "name": "walletRole",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  97,
                  108,
                  108,
                  101,
                  116,
                  95,
                  114,
                  111,
                  108,
                  101
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
          "name": "authorityWalletRole",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  97,
                  108,
                  108,
                  101,
                  116,
                  95,
                  114,
                  111,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "securityToken"
              },
              {
                "kind": "account",
                "path": "payer"
              }
            ]
          }
        },
        {
          "name": "accessControl",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99
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
          "name": "securityToken"
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
      "args": [
        {
          "name": "role",
          "type": "u8"
        }
      ]
    },
    {
      "name": "mintSecurities",
      "discriminator": [
        90,
        195,
        58,
        36,
        142,
        195,
        14,
        225
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "authorityWalletRole",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  97,
                  108,
                  108,
                  101,
                  116,
                  95,
                  114,
                  111,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "securityMint"
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "accessControl",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99
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
          "name": "securityMint",
          "writable": true
        },
        {
          "name": "destinationAccount",
          "writable": true
        },
        {
          "name": "destinationAuthority"
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
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
      "name": "updateWalletRole",
      "discriminator": [
        1,
        63,
        55,
        231,
        251,
        199,
        154,
        9
      ],
      "accounts": [
        {
          "name": "walletRole",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  97,
                  108,
                  108,
                  101,
                  116,
                  95,
                  114,
                  111,
                  108,
                  101
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
          "name": "authorityWalletRole",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  97,
                  108,
                  108,
                  101,
                  116,
                  95,
                  114,
                  111,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "securityToken"
              },
              {
                "kind": "account",
                "path": "payer"
              }
            ]
          }
        },
        {
          "name": "accessControl",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99
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
          "name": "securityToken"
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
      "args": [
        {
          "name": "role",
          "type": "u8"
        }
      ]
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
      "name": "initializeAccessControlArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "decimals",
            "type": "u8"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "symbol",
            "type": "string"
          },
          {
            "name": "uri",
            "type": "string"
          },
          {
            "name": "hookProgramId",
            "type": "pubkey"
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
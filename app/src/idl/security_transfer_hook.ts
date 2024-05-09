/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/security_transfer_hook.json`.
 */
export type SecurityTransferHook = {
  "address": "38jsTJqL7seGftcurfNJG1DsXa4WwCrHuNq4q1m9uZ9j",
  "metadata": {
    "name": "securityTransferHook",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "The security transfer hook program which checks permission for transfer groups"
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
          "name": "assetMint"
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
                "path": "assetMint"
              }
            ]
          }
        },
        {
          "name": "transferRestrictionData"
        },
        {
          "name": "securityTokenProgram",
          "address": "6yEnqdEjX3zBBDkzhwTRGJwv1jRaN4QE4gywmgdcfPBZ"
        },
        {
          "name": "securityAssociatedAccountFrom"
        },
        {
          "name": "securityAssociatedAccountTo"
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
    }
  ],
  "accounts": [
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
    }
  ],
  "types": [
    {
      "name": "securityAssociatedAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "group",
            "type": "pubkey"
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
            "name": "lockUntil",
            "type": "u64"
          }
        ]
      }
    }
  ]
};

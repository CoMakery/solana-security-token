# Solana Security Token

# Overview
This is a Security Token smart contract implementation from Upside. 
The core purpose of the token is to enforce transfer restrictions for certain groups.


This implementation attempts to balance simplicity and sufficiency for smart contract security tokens that need to comply with regulatory authorities - without adding unnecessary complexity for simple use cases.

Solana Security Token consists of several modules:
* **Access Management**
* **Transfer Groups and Rules Management**
* **Token2022 Security Token Tansfer**

### Disclaimer

This open or closed source software is provided with no warranty. This is not legal advice. CoMakery (dba Upside) is not a legal firm and is not your lawyer. Securities are highly regulated across multiple jurisdictions. Issuing a security token incorrectly can result in financial penalties or jail time if done incorrectly. Consult a lawyer and tax advisor. Conduct an independent security audit of the code.  

## Access Management

# Roles

The smart contract enforces specific admin roles. The roles divide responsibilities to reduce abuse vectors and create checks and balances. Ideally each role should be managed by a separate admin with separate key control. 

In some cases, such as for the Contract Admin or Wallets Admin, it is recommended that the role's private key is managed through multi-signature (e.g. requiring 2 of 3 or N of M approvers) authentication.

### Admin Types

The Admin functionality breaks down into 4 main roles. The contract is configured to expect these wallets. In the contract constructor:

- **Contract Admin**
  - Akin to root level access administrator. Can upgrade internal contract dependencies (ie `RestrictedSwap`, `TransferRules`) or grant Admin permissions. Recommended to be a secure multi-sig wallet.
- **Reserve Admin**
  - Receives initial tranche of minted tokens from deployment. Also can adjust the supply of tokens by minting or burning or forcibly initiate transfers.

Via granted roles (from **Contract Admin**):

- **Transfer Admin**
  - Can set transfer restriction permissions/rules between groups or invoke snapshots.
  - **Transfer Admin** capabilities are a superset of those of **Wallets Admin**.
- **Wallets Admin**
  - Can manage Holder/Wallet transfer group assignments.

Typically any legal entity third-party Transfer Agent will need access to both the roles for **Transfer Admin** and **Wallets Admin**. However some agents (such as exchanges) will, for example, be able to assign groups to wallets and permission them (as a **Wallets Admin**) but will not be able to adjust the transfer rules.

## Admin Functionality (WIP)

| Function                   | Contract Admin | Reserve Admin | Transfer Admin | Wallets Admin |
| -------------------------- | -------------- | ------------- | -------------- | ------------- |
| upgradeTransferRules()     | **yes**        | no            | no             | no            |
| snapshot()                 | **yes**        | no            | no             | no            |
| mint()                     | no             | **yes**       | no             | no            |
| burn()                     | no             | **yes**       | no             | no            |
| forceTransferBetween()     | no             | **yes**       | no             | no            |
| pause() or unpause (ie pause(false)) | no   | no            |  **yes**       | no            |           
| setMinWalletBalance()      | no             | no            | **yes**        | no            |
| setAllowGroupTransfer()    | no             | no            | **yes**        | no            |
| setHolderMax()             | no             | no            | **yes**        | no            |
| setHolderGroupMax()        | no             | no            | **yes**        | no            |
| fundDividend()             | no             | no            | **yes**        | no            |
| setAddressPermissions()    | no             | no            | **yes**        | **yes**       |
| freeze()                   | no             | no            | **yes**        | **yes**       |
| setTransferGroup()         | no             | no            | **yes**        | **yes**       |
| createHolderFromAddress()  | no             | no            | **yes**        | **yes**       |
| appendHolderAddress()      | no             | no            | **yes**        | **yes**       |
| addHolderWithAddresses()   | no             | no            | **yes**        | **yes**       |
| removeHolder()             | no             | no            | **yes**        | **yes**       |
| createReleaseSchedule()    | **yes**        | **yes**       | **yes**        | **yes**       |
| batchFundReleaseSchedule() | **yes**        | **yes**       | **yes**        | **yes**       |
| fundReleaseSchedule()      | **yes**        | **yes**       | **yes**        | **yes**       |

Note! Anyone can burn owned tokens by Solana SPL design

# Environment Setup

The environment is necessary to build and run tests of the project.

1. Install Anchor 0.30.0 from https://www.anchor-lang.com/docs/installation

## Build and test source code

### Build programs
```
$ anchor build
```

### Test programs
1. Generate payer if it doesn't exist yet
```
$ solana-keygen new
```
2. Run the functional and integration tests. First it builds and deploys the smart contract then tests are executed locally.
```
$ anchor test
```
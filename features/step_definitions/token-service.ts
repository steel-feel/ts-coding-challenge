import { Given, Then, When } from "@cucumber/cucumber";
import { accounts } from "../../src/config";
import { associateToken, createAccount, dropTokens, getBalances, getTokenBalance, setClientForHelper } from "../../src/token-helpers"
import { AccountBalance, AccountBalanceQuery, AccountCreateTransaction, AccountId, Client, Hbar, PrivateKey, Status, TokenAssociateTransaction, TokenCreateTransaction, TokenId, TokenInfoQuery, TokenMintTransaction, TokenSupplyType, TransferTransaction } from "@hashgraph/sdk";
import assert from "node:assert";

const client = Client.forTestnet()
setClientForHelper(client)

Given(/^A Hedera account with more than (\d+) hbar$/, async function (expectedBalance: number) {
  const account = accounts[0]
  const MY_ACCOUNT_ID = AccountId.fromString(account.id);
  // MY_ACCOUNT_ID.toString()
  const MY_PRIVATE_KEY = PrivateKey.fromStringED25519(account.privateKey);
  client.setOperator(MY_ACCOUNT_ID, MY_PRIVATE_KEY);

  // MY_PRIVATE_KEY.publicKey
  this.adminKey = MY_PRIVATE_KEY
  this.accountId = MY_ACCOUNT_ID
  // console.log("account Id",MY_ACCOUNT_ID.toString())

  //Create the query request
  const query = new AccountBalanceQuery().setAccountId(MY_ACCOUNT_ID);
  const balance = await query.execute(client)
  assert.ok(balance.hbars.toBigNumber().toNumber() > expectedBalance)
  // console.log("Balance",balance.hbars.toBigNumber().toNumber())

});

When(/^I create a token named Test Token \(HTT\)$/, async function () {
  const tx = await new TokenCreateTransaction()
    .setTokenName("Test Token")
    .setTokenSymbol("HTT")
    .setDecimals(2)
    .setAdminKey(this.adminKey.publicKey)
    .setTreasuryAccountId(this.accountId)
    .setSupplyKey(this.adminKey.publicKey)
    .freezeWith(client)
  const signTx = await (await tx.sign(this.adminKey)).sign(this.adminKey);

  const txResponse = await signTx.execute(client);
  const receipt = await txResponse.getReceipt(client);

  //Get the token ID from the receipt
  this.tokenId = receipt.tokenId;

});

Then(/^The token has the name "([^"]*)"$/, async function (expectedTokenName: string) {
  const q = new TokenInfoQuery({
    tokenId: this.tokenId
  })

  const info = await q.execute(client)
  // info.treasuryAccountId?.toString()
  assert.equal(info.name, expectedTokenName)
  this.info = info

});

Then(/^The token has the symbol "([^"]*)"$/, async function (expectedTokenSymbol: string) {
  assert.equal(this.info.symbol, expectedTokenSymbol)
});

Then(/^The token has (\d+) decimals$/, async function (expectedTokenDecimals: number) {
  assert.equal(this.info.decimals, expectedTokenDecimals)
});

Then(/^The token is owned by the account$/, async function () {
  assert.equal(this.info.treasuryAccountId?.toString(), this.accountId.toString())
});

Then(/^An attempt to mint (\d+) additional tokens succeeds$/, async function (mintAmount: number) {
  const transaction = await new TokenMintTransaction()
    .setTokenId(this.tokenId)
    .setAmount(mintAmount * (10 ** this.info.decimals))
    //  .setMaxTransactionFee(new Hbar(20)) //Use when HBAR is under 10 cents
    .freezeWith(client);

  //Sign with the supply private key of the token 
  const signTx = await transaction.sign(this.adminKey);

  const txResponse = await signTx.execute(client);

  //Request the receipt of the transaction
  const receipt = await txResponse.getReceipt(client);

  assert.equal(receipt.status, Status.Success)

});

When(/^I create a fixed supply token named Test Token \(HTT\) with (\d+) tokens$/, async function (maxSupply: number) {

  const tx = await new TokenCreateTransaction()
    .setTokenName("Test Token")
    .setTokenSymbol("HTT")
    .setDecimals(2)
    .setSupplyType(TokenSupplyType.Finite)
    .setMaxSupply(maxSupply * 100)
    .setInitialSupply(maxSupply * 100)
    .setAdminKey(this.adminKey.publicKey)
    .setTreasuryAccountId(this.accountId)
    .setSupplyKey(this.adminKey.publicKey)
    .freezeWith(client)
  const signTx = await (await tx.sign(this.adminKey)).sign(this.adminKey);

  const txResponse = await signTx.execute(client);
  const receipt = await txResponse.getReceipt(client);

  //Get the token ID from the receipt
  this.tokenId = receipt.tokenId;
});
Then(/^The total supply of the token is (\d+)$/, async function (expectedTotalSupply: number) {
  const q = new TokenInfoQuery({
    tokenId: this.tokenId
  })

  const info = await q.execute(client)
  assert.equal(info.totalSupply.toNumber(), expectedTotalSupply * (10 ** info.decimals))
});
Then(/^An attempt to mint tokens fails$/, async function () {
  const transaction = await new TokenMintTransaction()
    .setTokenId(this.tokenId)
    .setAmount(100)
    .freezeWith(client);

  const signTx = await transaction.sign(this.adminKey);
  const txResponse = await signTx.execute(client);

  await assert.rejects(txResponse.getReceipt(client));

});

Given(/^A first hedera account with more than (\d+) hbar$/, async function (expectedBalance: number) {
  const admin = accounts[0]
  const MY_ACCOUNT_ID = AccountId.fromString(admin.id);
  // MY_ACCOUNT_ID.toString()
  const MY_PRIVATE_KEY = PrivateKey.fromStringED25519(admin.privateKey);

  this.accountId = MY_ACCOUNT_ID
  this.adminKey = MY_PRIVATE_KEY

  const acc = accounts[1]
  this.firstAccount = {
    accountId: AccountId.fromString(acc.id),
    privateKey: PrivateKey.fromStringED25519(acc.privateKey)
  }

  const query = new AccountBalanceQuery().setAccountId(this.firstAccount.accountId);
  const balance = await query.execute(client)
  assert.ok(balance.hbars.toBigNumber().toNumber() > expectedBalance)

});
Given(/^A second Hedera account$/, async function () {
  const acc = accounts[2]
  this.secondAccount = {
    accountId: AccountId.fromString(acc.id),
    privateKey: PrivateKey.fromStringED25519(acc.privateKey)
  }

  const query = new AccountBalanceQuery().setAccountId(this.secondAccount.accountId);
  const balance = await query.execute(client)
  assert.ok(balance.hbars.toBigNumber().toNumber() > 10)

});

Given(/^A token named Test Token \(HTT\) with (\d+) tokens$/, async function (tokens: number) {
  const account = accounts[0]
  const MY_ACCOUNT_ID = AccountId.fromString(account.id);
  // MY_ACCOUNT_ID.toString()
  const MY_PRIVATE_KEY = PrivateKey.fromStringED25519(account.privateKey);
  client.setOperator(MY_ACCOUNT_ID, MY_PRIVATE_KEY);

  // MY_PRIVATE_KEY.publicKey
  this.adminKey = MY_PRIVATE_KEY
  this.accountId = MY_ACCOUNT_ID

  const decimals = 2
  const tx = await new TokenCreateTransaction()
    .setTokenName("Test Token")
    .setTokenSymbol("HTT")
    .setDecimals(decimals)
    .setSupplyType(TokenSupplyType.Finite)
    .setInitialSupply(tokens * (10 ** decimals))
    .setMaxSupply(tokens * (10 ** decimals))
    .setAdminKey(this.adminKey.publicKey)
    .setTreasuryAccountId(this.accountId)
    .setSupplyKey(this.adminKey.publicKey)
    .freezeWith(client)

  this.decimals = decimals

  const signTx = await (await tx.sign(this.adminKey)).sign(this.adminKey);

  const txResponse = await signTx.execute(client);
  const receipt = await txResponse.getReceipt(client);

  //Get the token ID from the receipt
  this.tokenId = receipt.tokenId;
});
Given(/^The first account holds (\d+) HTT tokens$/, async function (expectedFirstAccountBalance: number) {

  if (expectedFirstAccountBalance > 0 && await getTokenBalance.call(this, this.firstAccount.accountId) == 0) {
    await associateToken.call(this, this.firstAccount.accountId, this.firstAccount.privateKey)
    await dropTokens.call(this, expectedFirstAccountBalance, this.firstAccount.accountId)
  }

  const query = new AccountBalanceQuery().setAccountId(this.firstAccount.accountId);
  const balances = await query.execute(client)

  // console.log(JSON.stringify(balance.tokens))
  assert.equal(balances.tokens?.get(this.tokenId)?.toNumber() || 0, expectedFirstAccountBalance * (10 ** 2))
});
Given(/^The second account holds (\d+) HTT tokens$/, async function (expectedSecondAccountBalance: number) {
  if (expectedSecondAccountBalance > 0 && await getTokenBalance.call(this, this.secondAccount.accountId) == 0) {
    await associateToken.call(this, this.secondAccount.accountId, this.secondAccount.privateKey)
    await dropTokens.call(this, expectedSecondAccountBalance, this.secondAccount.accountId)
  }

  const query = new AccountBalanceQuery().setAccountId(this.secondAccount.accountId);
  const balances = await query.execute(client)

  assert.equal(balances.tokens?.get(this.tokenId)?.toNumber() || 0, expectedSecondAccountBalance * (10 ** 2))
});
When(/^The first account creates a transaction to transfer (\d+) HTT tokens to the second account$/, async function (tokensToTransfer: number) {

  await associateToken.call(this, this.secondAccount.accountId, this.secondAccount.privateKey)

  const transaction = await new TransferTransaction()
    .addTokenTransfer(this.tokenId, this.firstAccount.accountId, -tokensToTransfer * (10 ** 2))
    .addTokenTransfer(this.tokenId, this.secondAccount.accountId, tokensToTransfer * (10 ** 2))

  //Sign with the sender account private key
  const lClient = client.setOperator(this.firstAccount.accountId, this.firstAccount.privateKey)
  const signedTx = await transaction.freezeWith(lClient).sign(this.firstAccount.privateKey);

  this.signedTx = signedTx
});
When(/^The first account submits the transaction$/, async function () {
  const lClient = client.setOperator(this.firstAccount.accountId, this.firstAccount.privateKey)
  this.txResponse = await this.signedTx.execute(lClient);
  //Request the receipt of the transaction
  const receipt = await this.txResponse.getReceipt(lClient);
  //Obtain the transaction consensus status
  assert.equal(receipt.status, Status.Success)
});
When(/^The second account creates a transaction to transfer (\d+) HTT tokens to the first account$/, async function (tokensToTransfer: number) {
  await associateToken.call(this, this.firstAccount.accountId, this.firstAccount.privateKey)

  const transaction = await new TransferTransaction()
    .addTokenTransfer(this.tokenId, this.secondAccount.accountId, -tokensToTransfer * (10 ** 2))
    .addTokenTransfer(this.tokenId, this.firstAccount.accountId, tokensToTransfer * (10 ** 2))
    ;

  //Sign with the sender account private key
  const lClient = client.setOperator(this.firstAccount.accountId, this.firstAccount.privateKey)
  const signedTx = await transaction.freezeWith(lClient).sign(this.secondAccount.privateKey);
  this.signedTx = signedTx;

});
Then(/^The first account has paid for the transaction fee$/, async function () {
  assert.equal(this.txResponse.transactionId.accountId.toString(), this.firstAccount.accountId.toString())
});
Given(/^A first hedera account with more than (\d+) hbar and (\d+) HTT tokens$/, async function (hbarAmount: number, httAmount: number) {
  this.firstAccount = await createAccount(hbarAmount);

  if (httAmount > 0) {
    await associateToken.call(this, this.firstAccount.accountId, this.firstAccount.privateKey)
    await dropTokens.call(this, httAmount, this.firstAccount.accountId)
  }

  const balances = await getBalances.call(this, this.firstAccount.accountId)

  assert.equal(balances.hbars.toBigNumber().toString(), hbarAmount.toString())
  assert.equal(balances.tokens?.get(this.tokenId)?.toString(), (httAmount * (10 ** this.decimals)).toString())

});
Given(/^A second Hedera account with (\d+) hbar and (\d+) HTT tokens$/, async function (hbarAmount: number, httAmount: number) {
  this.secondAccount = await createAccount(hbarAmount);

  if (httAmount > 0) {
    await associateToken.call(this, this.secondAccount.accountId, this.secondAccount.privateKey)
    await dropTokens.call(this, httAmount, this.secondAccount.accountId)
  }

  const balances = await getBalances.call(this, this.secondAccount.accountId)

  assert.equal(balances.hbars.toBigNumber().toString(), hbarAmount.toString())
  assert.equal(balances.tokens?.get(this.tokenId)?.toString(), (httAmount * (10 ** this.decimals)).toString())

});
Given(/^A third Hedera account with (\d+) hbar and (\d+) HTT tokens$/, async function (hbarAmount: number, httAmount: number) {
  this.thirdAccount = await createAccount(hbarAmount);

  if (httAmount > 0) {
    await associateToken.call(this, this.thirdAccount.accountId, this.thirdAccount.privateKey)
    await dropTokens.call(this, httAmount, this.thirdAccount.accountId)
  }

  const balances = await getBalances.call(this, this.thirdAccount.accountId)

  assert.equal(balances.hbars.toBigNumber().toString(), hbarAmount.toString())
  assert.equal(balances.tokens?.get(this.tokenId)?.toString(), (httAmount * (10 ** this.decimals)).toString())

});
Given(/^A fourth Hedera account with (\d+) hbar and (\d+) HTT tokens$/, async function (hbarAmount: number, httAmount: number) {
  this.fourthAccount = await createAccount(hbarAmount);

  if (httAmount > 0) {
    await associateToken.call(this, this.fourthAccount.accountId, this.fourthAccount.privateKey)
    await dropTokens.call(this, httAmount, this.fourthAccount.accountId)
  }

  const balances = await getBalances.call(this, this.fourthAccount.accountId)

  assert.equal(balances.hbars.toBigNumber().toString(), hbarAmount.toString())
  assert.equal(balances.tokens?.get(this.tokenId)?.toString(), (httAmount * (10 ** this.decimals)).toString())

});
When(/^A transaction is created to transfer (\d+) HTT tokens out of the first and second account and (\d+) HTT tokens into the third account and (\d+) HTT tokens into the fourth account$/, async function (
  firstAmount: number,
  secondAmount: number,
  thirdAmount: number,
) {
  assert.equal(firstAmount * 2, secondAmount + thirdAmount)

  const transaction = await new TransferTransaction()
    .addTokenTransfer(this.tokenId, this.firstAccount.accountId, -firstAmount * (10 ** this.decimals))
    .addTokenTransfer(this.tokenId, this.secondAccount.accountId, -firstAmount * (10 ** this.decimals))
    .addTokenTransfer(this.tokenId, this.thirdAccount.accountId, secondAmount * (10 ** this.decimals))
    .addTokenTransfer(this.tokenId, this.fourthAccount.accountId, thirdAmount * (10 ** this.decimals))
    .freezeWith(client);

  const firstAccountSignature = this.firstAccount.privateKey.signTransaction(transaction)
  const secondAccountSignature = this.secondAccount.privateKey.signTransaction(transaction)

  this.signedTx = transaction.addSignature(this.firstAccount.privateKey.publicKey, firstAccountSignature)
    .addSignature(this.secondAccount.privateKey.publicKey, secondAccountSignature)


});
Then(/^The third account holds (\d+) HTT tokens$/, async function (expectedBalance: number) {
  const tokenBalance = await getTokenBalance.call(this, this.thirdAccount.accountId);
  assert.equal(tokenBalance, expectedBalance * (10 ** this.decimals))
});
Then(/^The fourth account holds (\d+) HTT tokens$/, async function (expectedBalance: number) {
  const tokenBalance = await getTokenBalance.call(this, this.fourthAccount.accountId);
  assert.equal(tokenBalance, expectedBalance * (10 ** this.decimals))
});

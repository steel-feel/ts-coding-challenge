import { Given, Then, When } from "@cucumber/cucumber";
import { accounts } from "../../src/config";
import { AccountBalanceQuery, AccountId, Client, Hbar, PrivateKey, Status, TokenAssociateTransaction, TokenCreateTransaction, TokenInfoQuery, TokenMintTransaction, TokenSupplyType, TransferTransaction } from "@hashgraph/sdk";
import assert from "node:assert";

const client = Client.forLocalNode()

Given(/^A Hedera account with more than (\d+) hbar$/, async function (expectedBalance: number) {
  const account = accounts[5]
  const MY_ACCOUNT_ID = AccountId.fromString(account.id);
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
  const acc = accounts[5]
  this.alice = {
    accountId: AccountId.fromString(acc.id),
    privateKey: PrivateKey.fromStringED25519(acc.privateKey)
  }

  client.setOperator(this.alice.accountId, this.alice.privateKey);

  const query = new AccountBalanceQuery().setAccountId(this.alice.accountId);
  const balance = await query.execute(client)
  assert.ok(balance.hbars.toBigNumber().toNumber() > expectedBalance)

});
Given(/^A second Hedera account$/, async function () {
  const acc = accounts[6]
  this.bob = {
    accountId: AccountId.fromString(acc.id),
    privateKey: PrivateKey.fromStringED25519(acc.privateKey)
  }

  const query = new AccountBalanceQuery().setAccountId(this.bob.accountId);
  const balance = await query.execute(client)
  assert.ok(balance.hbars.toBigNumber().toNumber() > 10)

});
Given(/^A token named Test Token \(HTT\) with (\d+) tokens$/, async function (tokens: number) {
  // console.log("Here");
  const decimals = 2
  const tx = await new TokenCreateTransaction()
    .setTokenName("Test Token")
    .setTokenSymbol("HTT")
    .setDecimals(decimals)
    .setTreasuryAccountId(this.alice.accountId)
    .setSupplyType(TokenSupplyType.Finite)
    .setInitialSupply(100 * (10 ** decimals))
    .setMaxSupply(tokens * (10 ** decimals))
    .setAdminKey(this.alice.privateKey.publicKey)
    .setSupplyKey(this.alice.privateKey.publicKey)
    .freezeWith(client)

  const signTx = await (await tx.sign(this.alice.privateKey)).sign(this.alice.privateKey);

  const txResponse = await signTx.execute(client);
  const receipt = await txResponse.getReceipt(client);

  //Get the token ID from the receipt
  this.tokenId = receipt.tokenId;
});
Given(/^The first account holds (\d+) HTT tokens$/, async function (expectedFirstAccountBalance: number) {
  const query = new AccountBalanceQuery().setAccountId(this.alice.accountId);
  const balances = await query.execute(client)

  // console.log(JSON.stringify(balance.tokens))
  assert.equal(balances.tokens?.get(this.tokenId)?.toNumber(), expectedFirstAccountBalance * (10 ** 2))
});
Given(/^The second account holds (\d+) HTT tokens$/, async function (expectedSecondAccountBalance: number) {
  const query = new AccountBalanceQuery().setAccountId(this.bob.accountId);
  const balances = await query.execute(client)
  // console.log(JSON.stringify(balance.tokens))
  assert.equal(balances.tokens?.get(this.tokenId)?.toNumber() || 0, expectedSecondAccountBalance * (10 ** 2))

});
When(/^The first account creates a transaction to transfer (\d+) HTT tokens to the second account$/, async function (tokensToTransfer: number) {

  const transaction = await new TransferTransaction()
    .addTokenTransfer(this.tokenId, this.alice.accountId, -tokensToTransfer * (10 ** 2))
    .addTokenTransfer(this.tokenId, this.bob.accountId, tokensToTransfer * (10 ** 2))
    .freezeWith(client);

  //Sign with the sender account private key
  this.signTx = await transaction.sign(this.alice.privateKey);

});
When(/^The first account submits the transaction$/, async function () {
  const transaction = await new TokenAssociateTransaction()
    .setAccountId(this.bob.accountId)
    .setTokenIds([this.tokenId])
    .freezeWith(client);

  //Sign with the private key of the account that is being associated to a token 
  const signTx = await transaction.sign(this.bob.privateKey);

  //Submit the transaction to a Hedera network    
  const txResponse2 = await signTx.execute(client);

  //Request the receipt of the transaction
  const receipt2 = await txResponse2.getReceipt(client);

  assert.equal(receipt2.status, Status.Success)

  //Sign with the client operator private key and submit to a Hedera network
  const txResponse = await this.signTx.execute(client);
  //Request the receipt of the transaction
  const receipt = await txResponse.getReceipt(client);

  //Obtain the transaction consensus status
  assert.equal(receipt.status, Status.Success)
});


When(/^The second account creates a transaction to transfer (\d+) HTT tokens to the first account$/, async function () {

});
Then(/^The first account has paid for the transaction fee$/, async function () {

});
Given(/^A first hedera account with more than (\d+) hbar and (\d+) HTT tokens$/, async function () {

});
Given(/^A second Hedera account with (\d+) hbar and (\d+) HTT tokens$/, async function () {

});
Given(/^A third Hedera account with (\d+) hbar and (\d+) HTT tokens$/, async function () {

});
Given(/^A fourth Hedera account with (\d+) hbar and (\d+) HTT tokens$/, async function () {

});
When(/^A transaction is created to transfer (\d+) HTT tokens out of the first and second account and (\d+) HTT tokens into the third account and (\d+) HTT tokens into the fourth account$/, async function () {

});
Then(/^The third account holds (\d+) HTT tokens$/, async function () {

});
Then(/^The fourth account holds (\d+) HTT tokens$/, async function () {

});

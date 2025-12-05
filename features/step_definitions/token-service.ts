import { Given, Then, When } from "@cucumber/cucumber";
import { accounts } from "../../src/config";
import { AccountBalance, AccountBalanceQuery, AccountCreateTransaction, AccountId, Client, Hbar, PrivateKey, Status, TokenAssociateTransaction, TokenCreateTransaction, TokenId, TokenInfoQuery, TokenMintTransaction, TokenSupplyType, TransferTransaction } from "@hashgraph/sdk";
import assert from "node:assert";

const client = Client.forTestnet()

type PartyAccount = {
  accountId: AccountId;
  privateKey: PrivateKey
}

async function createAccount(initBalance: number): Promise<PartyAccount> {
  const privateKey = await PrivateKey.generateED25519Async();

  //Create the transaction
  const transaction = new AccountCreateTransaction()
    // .setKeyWithAlias(privateKey.p)
    // DO NOT set an alias with your key if you plan to update/rotate keys in the future, Use .setKeyWithoutAlias instead 
    .setKeyWithoutAlias(privateKey.publicKey)
    .setInitialBalance(new Hbar(initBalance));

  //Sign the transaction with the client operator private key and submit to a Hedera network
  const txResponse = await transaction.execute(client);

  return {
    accountId: (await txResponse.getReceipt(client)).accountId as AccountId,
    privateKey
  }
}

async function associateToken(receiver: AccountId, receiverPrivateKey: PrivateKey) {
  //@ts-ignore
  var that = this;
  try {
    const transaction = await new TokenAssociateTransaction()
      .setAccountId(receiver)
      .setTokenIds([that.tokenId])
      .freezeWith(client);

    //Sign with the private key of the account that is being associated to a token 
    const signTx = await transaction.sign(receiverPrivateKey);

    //Submit the transaction to a Hedera network    
    const txResponse2 = await signTx.execute(client);

    //Request the receipt of the transaction
    const receipt2 = await txResponse2.getReceipt(client);

    assert.equal(receipt2.status, Status.Success)
  } catch (err: any) {
    console.log(`Error while associate ${receiver.toString()}`);
    console.log( err.status == Status.TokenAlreadyAssociatedToAccount );
    //Ignore since might already be associated
  }
}

//Method to award tokens to receiver
async function getTokens(amount: number, receiver: AccountId) {
  //@ts-ignore
  let that = this;

  const transaction = await new TransferTransaction()
    .addTokenTransfer(that.tokenId, that.accountId, -amount * (10 ** that.decimals))
    .addTokenTransfer(that.tokenId, receiver, amount * (10 ** that.decimals))
    .freezeWith(client);

  //Sign with the supply private key of the token 
  const signTx = await transaction.sign(that.adminKey);

  const txResponse = await signTx.execute(client);

  //Request the receipt of the transaction
  await txResponse.getReceipt(client);
}

//get the token balance
async function getTokenBalance(accountId: AccountId): Promise<number> {
  //@ts-ignore
  var that = this
  const balances = await getBalances.call(that, accountId)
  return balances.tokens?.get(that.tokenId)?.toNumber() || 0
}

function getBalances(accountId: AccountId): Promise<AccountBalance> {
  const query = new AccountBalanceQuery().setAccountId(accountId);
  return query.execute(client)
}

async function createToken(tokens: number): Promise<TokenId | null> {
  //@ts-ignore
  let that = this
  const tx = await new TokenCreateTransaction()
    .setTokenName("Test Token")
    .setTokenSymbol("HTT")
    .setDecimals(that.decimals)
    .setSupplyType(TokenSupplyType.Finite)
    .setInitialSupply(tokens * (10 ** that.decimals))
    .setMaxSupply(tokens * (10 ** that.decimals))
    .setAdminKey(that.adminKey.publicKey)
    .setTreasuryAccountId(that.accountId)
    .setSupplyKey(that.adminKey.publicKey)
    .freezeWith(client)

  const signTx = await (await tx.sign(that.adminKey)).sign(that.adminKey);

  const txResponse = await signTx.execute(client);
  const receipt = await txResponse.getReceipt(client);

  return receipt.tokenId
}


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
  this.alice = {
    accountId: AccountId.fromString(acc.id),
    privateKey: PrivateKey.fromStringED25519(acc.privateKey)
  }

  const query = new AccountBalanceQuery().setAccountId(this.alice.accountId);
  const balance = await query.execute(client)
  assert.ok(balance.hbars.toBigNumber().toNumber() > expectedBalance)

});
Given(/^A second Hedera account$/, async function () {
  const acc = accounts[2]
  this.bob = {
    accountId: AccountId.fromString(acc.id),
    privateKey: PrivateKey.fromStringED25519(acc.privateKey)
  }

  const query = new AccountBalanceQuery().setAccountId(this.bob.accountId);
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

  if (expectedFirstAccountBalance > 0 && await getTokenBalance.call(this, this.alice.accountId) == 0) {
    await associateToken.call(this, this.alice.accountId, this.alice.privateKey)
    await getTokens.call(this, expectedFirstAccountBalance, this.alice.accountId)
  }

  const query = new AccountBalanceQuery().setAccountId(this.alice.accountId);
  const balances = await query.execute(client)

  // console.log(JSON.stringify(balance.tokens))
  assert.equal(balances.tokens?.get(this.tokenId)?.toNumber() || 0, expectedFirstAccountBalance * (10 ** 2))
});
Given(/^The second account holds (\d+) HTT tokens$/, async function (expectedSecondAccountBalance: number) {
  if (expectedSecondAccountBalance > 0 && await getTokenBalance.call(this, this.bob.accountId) == 0) {
    await associateToken.call(this, this.bob.accountId, this.bob.privateKey)
    await getTokens.call(this, expectedSecondAccountBalance, this.bob.accountId)
  }

  const query = new AccountBalanceQuery().setAccountId(this.bob.accountId);
  const balances = await query.execute(client)

  assert.equal(balances.tokens?.get(this.tokenId)?.toNumber() || 0, expectedSecondAccountBalance * (10 ** 2))
});
When(/^The first account creates a transaction to transfer (\d+) HTT tokens to the second account$/, async function (tokensToTransfer: number) {

  await associateToken.call(this, this.bob.accountId, this.bob.privateKey)

  const transaction = await new TransferTransaction()
    .addTokenTransfer(this.tokenId, this.alice.accountId, -tokensToTransfer * (10 ** 2))
    .addTokenTransfer(this.tokenId, this.bob.accountId, tokensToTransfer * (10 ** 2))
  
  //Sign with the sender account private key
  const lClient = client.setOperator(this.alice.accountId,this.alice.privateKey)
  const signedTx = await transaction.freezeWith(lClient).sign(this.alice.privateKey);

  this.signedTx = signedTx
});
When(/^The first account submits the transaction$/, async function () {
  const lClient = client.setOperator(this.alice.accountId, this.alice.privateKey)
  this.txResponse = await this.signedTx.execute(lClient);
  //Request the receipt of the transaction
  const receipt = await this.txResponse.getReceipt(lClient);
  //Obtain the transaction consensus status
  assert.equal(receipt.status, Status.Success)
});


When(/^The second account creates a transaction to transfer (\d+) HTT tokens to the first account$/, async function (tokensToTransfer: number) {
  await associateToken.call(this, this.alice.accountId, this.alice.privateKey)

  const transaction = await new TransferTransaction()
    .addTokenTransfer(this.tokenId, this.bob.accountId, -tokensToTransfer * (10 ** 2))
    .addTokenTransfer(this.tokenId, this.alice.accountId, tokensToTransfer * (10 ** 2))
    ;

  //Sign with the sender account private key
  const lClient = client.setOperator(this.alice.accountId, this.alice.privateKey)
  const signedTx = await transaction.freezeWith(lClient).sign(this.bob.privateKey);
  this.signedTx = signedTx;

});
Then(/^The first account has paid for the transaction fee$/, async function () {
  assert.equal(this.txResponse.transactionId.accountId.toString(), this.alice.accountId.toString())
});
Given(/^A first hedera account with more than (\d+) hbar and (\d+) HTT tokens$/, async function (hbarAmount: number, httAmount: number) {
  this.alice = await createAccount(hbarAmount);

  if (httAmount > 0) {
    await associateToken.call(this, this.alice.accountId, this.alice.privateKey)
    await getTokens.call(this, httAmount, this.alice.accountId)
  }

  const balances = await getBalances.call(this, this.alice.accountId)

  assert.equal(balances.hbars.toBigNumber().toString(), hbarAmount.toString())
  assert.equal(balances.tokens?.get(this.tokenId)?.toString(), (httAmount * (10 ** this.decimals)).toString())

});
Given(/^A second Hedera account with (\d+) hbar and (\d+) HTT tokens$/, async function (hbarAmount: number, httAmount: number) {
  this.bob = await createAccount(hbarAmount);

  if (httAmount > 0) {
    await associateToken.call(this, this.bob.accountId, this.bob.privateKey)
    await getTokens.call(this, httAmount, this.bob.accountId)
  }

  const balances = await getBalances.call(this, this.bob.accountId)

  assert.equal(balances.hbars.toBigNumber().toString(), hbarAmount.toString())
  assert.equal(balances.tokens?.get(this.tokenId)?.toString(), (httAmount * (10 ** this.decimals)).toString())

});
Given(/^A third Hedera account with (\d+) hbar and (\d+) HTT tokens$/, async function (hbarAmount: number, httAmount: number) {
  this.charlie = await createAccount(hbarAmount);

  if (httAmount > 0) {
    await associateToken.call(this, this.charlie.accountId, this.charlie.privateKey)
    await getTokens.call(this, httAmount, this.charlie.accountId)
  }

  const balances = await getBalances.call(this, this.charlie.accountId)

  assert.equal(balances.hbars.toBigNumber().toString(), hbarAmount.toString())
  assert.equal(balances.tokens?.get(this.tokenId)?.toString(), (httAmount * (10 ** this.decimals)).toString())

});
Given(/^A fourth Hedera account with (\d+) hbar and (\d+) HTT tokens$/, async function (hbarAmount: number, httAmount: number) {
  this.denise = await createAccount(hbarAmount);

  if (httAmount > 0) {
    await associateToken.call(this, this.denise.accountId, this.denise.privateKey)
    await getTokens.call(this, httAmount, this.denise.accountId)
  }

  const balances = await getBalances.call(this, this.denise.accountId)

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
    .addTokenTransfer(this.tokenId, this.alice.accountId, -firstAmount * (10 ** this.decimals))
    .addTokenTransfer(this.tokenId, this.bob.accountId, -firstAmount * (10 ** this.decimals))
    .addTokenTransfer(this.tokenId, this.charlie.accountId, secondAmount * (10 ** this.decimals))
    .addTokenTransfer(this.tokenId, this.denise.accountId, thirdAmount * (10 ** this.decimals))
    .freezeWith(client);

  const aliceSignature = this.alice.privateKey.signTransaction(transaction)
  const bobSignature = this.bob.privateKey.signTransaction(transaction)

  this.signedTx = transaction.addSignature(this.alice.privateKey.publicKey, aliceSignature)
    .addSignature(this.bob.privateKey.publicKey, bobSignature)


});
Then(/^The third account holds (\d+) HTT tokens$/, async function (expectedBalance: number) {
  const tokenBalance = await getTokenBalance.call(this, this.charlie.accountId);
  assert.equal(tokenBalance, expectedBalance * (10 ** this.decimals))
});
Then(/^The fourth account holds (\d+) HTT tokens$/, async function (expectedBalance: number) {
  const tokenBalance = await getTokenBalance.call(this, this.denise.accountId);
  assert.equal(tokenBalance, expectedBalance * (10 ** this.decimals))
});

import { Given, Then, When } from "@cucumber/cucumber";
import {
  AccountBalanceQuery,
  AccountId,
  Client,
  KeyList,
  PrivateKey, 
  TopicCreateTransaction,
  TopicMessageQuery, TopicMessageSubmitTransaction
} from "@hashgraph/sdk";
import { accounts } from "../../src/config";
import assert from "node:assert";

// Pre-configured client for test network (testnet)
const client = Client.forTestnet()

//Set the operator with the account ID and private key

Given(/^a first account with more than (\d+) hbars$/, async function (expectedBalance: number) {
  const acc = accounts[0]
  const account: AccountId = AccountId.fromString(acc.id);
  this.account = account
  const privKey: PrivateKey = PrivateKey.fromStringED25519(acc.privateKey);
  this.privKey = privKey
  client.setOperator(this.account, privKey);

  // console.log(`evm address : ${account.toEvmAddress()} , accountId : ${acc.id}`);
  
  //Create the query request
  const query = new AccountBalanceQuery().setAccountId(account);
  const balance = await query.execute(client)

  // console.log(`balance : ${balance.hbars.toBigNumber().toNumber()}`);
  assert.ok(balance.hbars.toBigNumber().toNumber() > expectedBalance)
});

When(/^A topic is created with the memo "([^"]*)" with the first account as the submit key$/, async function (memo: string) {
  const tx = await new TopicCreateTransaction({ topicMemo: memo, submitKey: this.privKey.publicKey })
  .execute(client);
  const receipt = await tx.getReceipt(client);
  this.topicId = receipt.topicId;
  assert.ok(this.topicId)
});

When(/^The message "([^"]*)" is published to the topic$/, async function (message: string) {  
 const tx = await new TopicMessageSubmitTransaction({ topicId: this.topicId, message }).execute(client)
 const receipt = await tx.getReceipt(client);

 assert.ok(receipt)
});

Then(/^The message "([^"]*)" is received by the topic and can be printed to the console$/, async function (message: string) {
 const subscriptionHandle = await new TopicMessageQuery({ topicId: this.topicId })
    .subscribe(
      client,
      (error) => { console.log(`Error: ${error}`);  subscriptionHandle.unsubscribe(); },
      (message) => {console.log(message.toString()) ; subscriptionHandle.unsubscribe();
    });
    
});

Given(/^A second account with more than (\d+) hbars$/, async function (expectedBalance: number) {
  const acc = accounts[1]
  const account: AccountId = AccountId.fromString(acc.id);
  this.account2 = account
  const privKey: PrivateKey = PrivateKey.fromStringED25519(acc.privateKey);
  this.privKey2 = privKey

  //Create the query request
  const query = new AccountBalanceQuery().setAccountId(account);
  const balance = await query.execute(client)
  assert.ok(balance.hbars.toBigNumber().toNumber() > expectedBalance)
});

Given(/^A (\d+) of (\d+) threshold key with the first and second account$/, async function (threshold: number, totalKeys : number) {
  const publicKeyList = [this.privKey.publicKey, this.privKey2.publicKey];
  const thresholdKey =  new KeyList(publicKeyList,threshold); 
  this.thresholdKey = thresholdKey
  assert.ok(this.thresholdKey.toArray().length == totalKeys)
  assert.ok(this.thresholdKey.threshold == threshold)
});

When(/^A topic is created with the memo "([^"]*)" with the threshold key as the submit key$/, async function (memo: string) {
    const tx = await new TopicCreateTransaction({ topicMemo: memo, submitKey: this.thresholdKey })
    const freezedTx = await tx.freezeWith(client);

    const signature = this.privKey.signTransaction(freezedTx);
    const signedTransaction = freezedTx.addSignature(this.privKey.publicKey, signature)

    const submitTx = await signedTransaction.execute(client)
    const receipt = await submitTx.getReceipt(client);

    this.topicId = receipt.topicId
    assert.ok(this.topicId)
    
});


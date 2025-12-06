import { AccountBalance, AccountBalanceQuery, AccountCreateTransaction, AccountId, Client, Hbar, PrivateKey, Status, TokenAssociateTransaction, TransferTransaction } from "@hashgraph/sdk";

export type CustomAccount = {
    accountId: AccountId;
    privateKey: PrivateKey
}

export let client: Client;

export function setClientForHelper(_client: Client) {
    client = _client
}

/**
 * create a new Hedera account 
 * @param initBalance  Hbar amount to initialise account with
 * @returns Custom Helper account
 */
export async function createAccount(initBalance: number): Promise<CustomAccount> {
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
/**
 * Associate the token with account
 * @param receiver receipent account Id
 * @param receiverPrivateKey receipent private key
 */
export async function associateToken(receiver: AccountId, receiverPrivateKey: PrivateKey) {
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
        await signTx.execute(client);

    } catch (err: any) {
        console.log(`Error while associate ${receiver.toString()}`);
        console.log(err.status == Status.TokenAlreadyAssociatedToAccount);
    }
}

/**
 * Drop tokens to receiver
 * @param amount number of tokens
 * @param receiver Hedera account Id
 * @returns void
 */
export async function dropTokens(amount: number, receiver: AccountId) {
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

/**
 * Get balance of specified tokenId for the account
 * @param accountId Hedera Account Id
 * @returns Balance amount (with decimals). '0' if tokens are NOT present in tokensList.
 */
export async function getTokenBalance(accountId: AccountId): Promise<number> {
    //@ts-ignore
    var that = this
    const balances = await getBalances.call(that, accountId)
    return balances.tokens?.get(that.tokenId)?.toNumber() || 0
}

/**
 * Get the balances for the Hedera account Id
 * @param accountId Hedera account Id
 * @returns Account balances Map
 */
export function getBalances(accountId: AccountId): Promise<AccountBalance> {
    const query = new AccountBalanceQuery().setAccountId(accountId);
    return query.execute(client)
}

import * as web3 from "@solana/web3.js";
import signer from "./id.json";
import * as borsh from "borsh";

class GreetingAccount {
    counter = 0;
    constructor(fields: { counter: number } | undefined = undefined) {
        if (fields) {
            this.counter = fields.counter;
        }
    }
}

const GreetingSchema = new Map([
    [GreetingAccount, { kind: 'struct', fields: [['counter', 'u32']] }],
]);

const GREETING_SIZE = borsh.serialize(
    GreetingSchema,
    new GreetingAccount(),
).length;

async function checkProgram(connection: web3.Connection, programId: web3.PublicKey, payer: web3.Signer): Promise<web3.PublicKey> {
    const GREETING_SEED = 'hello';
    const greetedPubkey = await web3.PublicKey.createWithSeed(payer.publicKey, GREETING_SEED, programId,);

    const greetedAccount = await connection.getAccountInfo(greetedPubkey);
    if (greetedAccount === null) {
        console.log(
            'Creating account',
            greetedPubkey.toBase58(),
            'to say hello to',
        );
        const lamports = await connection.getMinimumBalanceForRentExemption(
            GREETING_SIZE,
        );

        const transaction = new web3.Transaction().add(
            web3.SystemProgram.createAccountWithSeed({
                fromPubkey: payer.publicKey,
                basePubkey: payer.publicKey,
                seed: GREETING_SEED,
                newAccountPubkey: greetedPubkey,
                lamports,
                space: GREETING_SIZE,
                programId,
            }),
        );
        await web3.sendAndConfirmTransaction(connection, transaction, [payer]);
    }
    return greetedPubkey;
}

async function sayHello(connection: web3.Connection, programId: web3.PublicKey, greetedPubkey: web3.PublicKey, payer: web3.Signer): Promise<string> {
    console.log('Saying hello to', greetedPubkey.toBase58());
    const instruction = new web3.TransactionInstruction({
        keys: [{ pubkey: greetedPubkey, isSigner: false, isWritable: true }],
        programId,
        data: Buffer.alloc(0), // All instructions are hellos
    });
    return await web3.sendAndConfirmTransaction(
        connection,
        new web3.Transaction().add(instruction),
        [payer],
    );
}

export async function reportGreetings(connection: web3.Connection, greetedPubkey: web3.PublicKey): Promise<void> {
    const accountInfo = await connection.getAccountInfo(greetedPubkey);
    if (accountInfo === null) {
        throw 'Error: cannot find the greeted account';
    }
    const greeting = borsh.deserialize(
        GreetingSchema,
        GreetingAccount,
        accountInfo.data,
    );
    console.log(
        greetedPubkey.toBase58(),
        'has been greeted',
        greeting.counter,
        'time(s)',
    );
}

(async () => {
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"), "confirmed");
    const programId = new web3.PublicKey(
        "7btka46fnB7PPyTPD61SS5jWeN1uxhMSsAbGVbRSjxiK"
    );
    const _signer = web3.Keypair.fromSecretKey(Uint8Array.from(signer));
    const greetedPubkey = await checkProgram(connection, programId, _signer);

    await reportGreetings(connection, greetedPubkey);
    console.log(`[tsx]: ${await sayHello(connection, programId, greetedPubkey, _signer)}`);
    await reportGreetings(connection, greetedPubkey);
})();

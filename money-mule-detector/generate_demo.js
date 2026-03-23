import fs from 'fs';

const txs = [];
let txId = 1;

function addTx(sender, receiver, amount) {
    const timestamp = new Date(Date.now() - Math.random() * 10000000).toISOString().replace('T', ' ').slice(0, 19);
    txs.push(`TX${String(txId++).padStart(4, '0')},${sender},${receiver},${amount},${timestamp}`);
}

// 1. Smurfing Ring
for(let i=1; i<=15; i++) {
    addTx(`SMURF_SRC_${i}`, 'SMURF_HUB', Math.floor(Math.random() * 400) + 100);
}
addTx('SMURF_HUB', 'SMURF_DEST', 4000);

// 2. Shell Chain
addTx('SHELL_1', 'SHELL_2', 50000);
addTx('SHELL_2', 'SHELL_3', 49000);
addTx('SHELL_3', 'SHELL_4', 48500);
addTx('SHELL_4', 'SHELL_5', 47500);
addTx('SHELL_5', 'SHELL_6', 47000);

// 3. Cycle
addTx('CYCLE_A', 'CYCLE_B', 15000);
addTx('CYCLE_B', 'CYCLE_C', 15000);
addTx('CYCLE_C', 'CYCLE_D', 15000);
addTx('CYCLE_D', 'CYCLE_A', 15000);

// 4. Normal noise
for(let i=0; i<400; i++) {
    const s = `USER_${Math.floor(Math.random() * 150)}`;
    const r = `USER_${Math.floor(Math.random() * 150)}`;
    if (s !== r) {
        addTx(s, r, Math.floor(Math.random() * 1500) + 10);
    }
}

const header = "transaction_id,sender_id,receiver_id,amount,timestamp\n";
fs.writeFileSync('public/demo.csv', header + txs.join('\n'));
console.log("demo.csv generated with " + txs.length + " transactions.");

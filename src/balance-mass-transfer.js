const fs = require("fs");
const CSVParser = require("csv-parse/lib/sync");
const GetCSVWriter = require('csv-writer').createObjectCsvWriter;
const optimist = require('optimist');
var BigNumber = require('bignumber.js');

const ENCODING = 'utf-8';

module.exports = function () {
    const logs = [];

    var argv = optimist.argv;
    const csvFilePath = argv.data;
    const txBatchSize = argv.batch_size;
    const gasPrice = web3.toWei(argv.gas_price, 'gwei');
    const target = "0x" + argv.target;

    const rawData = fs.readFileSync(csvFilePath).toString(ENCODING);
    const data = CSVParser(rawData, {columns: true});

    if (data.length == 0) {
        throw "Data file is empty or incorrect CSVParser format. Aborted";
    }

    let transfers = [];
    for (let row of data) {
        transfers.push({address: web3.toHex(row.address), password: row.password});
    }

    const logPath = csvFilePath.slice(0, csvFilePath.lastIndexOf('/')) + "/log.csv";
    const logWriter = GetCSVWriter({
        encoding: ENCODING,
        path: logPath,
        header: [
            {id: 'address', title: 'address'},
            {id: 'balance', title: 'balance'},
            {id: 'cost', title: 'cost'},
            {id: 'hash', title: 'hash'},
            {id: 'status', title: 'status'}
        ]
    });
    
    const estimateCost = 21000 * gasPrice;
    console.log("Estimated cost:", estimateCost);

    terminal(0);

    function terminal(position) {
        const stdin = process.stdin, stdout = process.stdout;

        stdin.resume();
        stdout.write("Continue? (print 'exit' to finish or ctrl+C) ");

        stdin.once('data', (data) => {
            data = data.toString().trim();

            if (data == "exit") {
                process.exit();
            } else {
                doBalanceTransfer(position)
            }
        });
    }


    function doBalanceTransfer(fromIdx) {
        if (fromIdx == transfers.length) {
            console.log("Finished");
            return;
        }

        const batch = [];

        const count = parseInt(fromIdx) + parseInt(txBatchSize);
        const to = count >= transfers.length ? transfers.length : count;

        for (let from = fromIdx; from < to; from++) {
            const promise = send(transfers[from]);
            batch.push(promise);
        }

        Promise
        .all(batch)
        .then(() => {
            console.log("Transfered. From idx", fromIdx, "to", to - 1);
            logWriter.writeRecords(logs);

            terminal(to);
        });
    }

    function send(account) {
        return new Promise((resolve, reject) => {

            console.log("Send new transaction for", account.address);

            const logObject = {};
            logObject.address = account.address;
            logObject.password = account.password;

            web3.eth.getBalance(logObject.address, (err, currentBalance) => {
                if (err) {
                    logObject.status = "[ERR] Failed to send for " + account.address + ". Error: " + err.toString();
                    logs.push(logObject);
                    return reject(err);
                }

                console.log("Current balance of ", account.address, " is", currentBalance.valueOf());

                logObject.balance = currentBalance.valueOf();

                if (estimateCost > logObject.balance) {
                    logObject.status = "[ERR] Insufficient funds " + account.address;
                    logs.push(logObject);
                    return resolve(logObject);
                }

                let txData = {
                    from: logObject.address,
                    to: target,
                    value: logObject.balance,
                    gasPrice: gasPrice,
                    gas: 21000
                };

                const transferAmount = new BigNumber(logObject.balance).minus(estimateCost);
                logObject.balance = transferAmount;
                txData.value = transferAmount;

                web3.personal.sendTransaction(txData, logObject.password, (err, hash) => {
                    if (err) {
                        logObject.status = "[ERR] " + err.toString();
                        console.error("Error", logObject.status);
                        logs.push(logObject);

                        return reject(err);
                    }

                    logObject.hash = hash;

                    console.log("[INFO] Transaction send: ", logObject.hash);
                    logObject.status = "[INFO] Transaction send:" + logObject.hash;
                    logs.push(logObject);

                    return resolve(hash);
                }
            );
        })
    })
}
};

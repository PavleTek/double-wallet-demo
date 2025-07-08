const { app, BrowserWindow, ipcMain } = require("electron");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const bitcoin = require("bitcoinjs-lib");
const bip32 = require("bip32");
const { ethers } = require("ethers");
const ECPairFactory = require("ecpair").default;
const ecc = require("tiny-secp256k1");
bitcoin.initEccLib(ecc);
const axios = require("axios");
const { executeBitcoinTransaction } = require("./bitcoinTransactionHelper.js");
const { sendEthereumTransaction } = require("./ethereumTransactionHelper.js");

const ECPair = ECPairFactory(ecc);
const bitcoinNetwork = bitcoin.networks.testnet;

// Utility function to validate Bitcoin address
function validateBitcoinAddress(address, network) {
  try {
    bitcoin.address.toOutputScript(address, network);
    return true;
  } catch (error) {
    return false;
  }
}
// Utility function to estimate transaction size in vbytes
function estimateTransactionSize(inputCount, outputCount, isSegwit = true) {
  if (isSegwit) {
    // P2WPKH input: ~68 vbytes, P2WPKH output: ~31 vbytes, overhead: ~10 vbytes
    return inputCount * 68 + outputCount * 31 + 10;
  } else {
    // Legacy input: ~148 bytes, Legacy output: ~34 bytes, overhead: ~10 bytes
    return inputCount * 148 + outputCount * 34 + 10;
  }
}

let bitcoinWalletData = null;
let ethereumWalletData = null;

const ethereumWalletFile = path.join(__dirname, "../ethereum_wallet.json");
const configFile = path.join(__dirname, "../config.json");

function loadOrCreateBitcoinWallet() {
  const testnetWalletFile = path.join(__dirname, "../bitcoin_wallet_testnet.json");
  const mainnetWalletFile = path.join(__dirname, "../bitcoin_wallet_mainnet.json");

  let testnetWalletData;
  if (fs.existsSync(testnetWalletFile)) {
    testnetWalletData = JSON.parse(fs.readFileSync(testnetWalletFile));
  } else {
    const keyPair = ECPair.makeRandom({ network: bitcoin.networks.testnet });
    const { address } = bitcoin.payments.p2wpkh({
      pubkey: Buffer.from(keyPair.publicKey),
      network: bitcoin.networks.testnet,
    });
    const privateKey = keyPair.toWIF();
    testnetWalletData = { address, privateKey };
    fs.writeFileSync(testnetWalletFile, JSON.stringify(testnetWalletData, null, 4));
  }

  let mainnetWalletData;
  if (fs.existsSync(mainnetWalletFile)) {
    mainnetWalletData = JSON.parse(fs.readFileSync(mainnetWalletFile));
  } else {
    const keyPair = ECPair.makeRandom({ network: bitcoin.networks.bitcoin });
    const { address } = bitcoin.payments.p2wpkh({
      pubkey: Buffer.from(keyPair.publicKey),
      network: bitcoin.networks.bitcoin,
    });
    const privateKey = keyPair.toWIF();
    mainnetWalletData = { address, privateKey };
    fs.writeFileSync(mainnetWalletFile, JSON.stringify(mainnetWalletData, null, 4));npm
  }

  bitcoinWalletData = {
    testnet: testnetWalletData,
    mainnet: mainnetWalletData,
  };
}

function loadOrCreateEthereumWallet() {
  if (fs.existsSync(ethereumWalletFile)) {
    ethereumWalletData = JSON.parse(fs.readFileSync(ethereumWalletFile));
  } else {
    const wallet = ethers.Wallet.createRandom();
    ethereumWalletData = {
      address: wallet.address,
      privateKey: wallet.privateKey,
    };
    fs.writeFileSync(
      ethereumWalletFile,
      JSON.stringify(ethereumWalletData, null, 4)
    );
  }
}

function createWindow() {
  const indexPath = path.join(__dirname, "dist/front-end/browser/index.html");

  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.loadFile(indexPath).catch((err) => {
    console.error("Failed to load index.html:", err);
  });
}

function createDefaultConfigFile() {
  const defaultConfig = {
    bitcoinFee: 250,
    gasLimit: 21000,
    gasPrice: 25,
    testnet: {
      bitcoin: {
        apiBase: "https://blockstream.info/testnet/api",
      },
      ethereum: {
        network: "sepolia",
        rpcUrl: "https://sepolia.infura.io/v3/PASTE_YOUR_API_KEY_HERE",
      },
    },
    mainnet: {
      bitcoin: {
        apiBase: "https://blockstream.info/api",
      },
      ethereum: {
        network: "mainnet",
        rpcUrl: "https://mainnet.infura.io/v3/PASTE_YOUR_API_KEY_HERE",
      },
    },
  };
  if (!fs.existsSync(configFile)) {
    fs.writeFileSync(configFile, JSON.stringify(defaultConfig, null, 2));
  } else {
  }
}

function updateConfigFile(newConfig) {
  if (typeof newConfig.bitcoinFee === "undefined") {
    newConfig.bitcoinFee = 25;
  }
  if (typeof newConfig.gasPrice === "undefined") {
    newConfig.gasPrice = 20;
  }
  ["testnet", "mainnet"].forEach((net) => {
    if (
      newConfig[net] &&
      newConfig[net].bitcoin &&
      newConfig[net].bitcoin.fee
    ) {
      delete newConfig[net].bitcoin.fee;
    }
  });
  fs.writeFileSync(configFile, JSON.stringify(newConfig, null, 2));
}

function sendBitcoin() {}

app.whenReady().then(() => {
  loadOrCreateBitcoinWallet();
  loadOrCreateEthereumWallet();
  createWindow();
  createDefaultConfigFile();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// IPC handler to get Bitcoin address (mainnet by default for backward compatibility)
ipcMain.handle("get-bitcoin-address", async () => {
  return bitcoinWalletData && bitcoinWalletData.mainnet
    ? bitcoinWalletData.mainnet.address
    : null;
});

// IPC handler to get Bitcoin address for mainnet
ipcMain.handle("get-bitcoin-address-mainnet", async () => {
  return bitcoinWalletData && bitcoinWalletData.mainnet
    ? bitcoinWalletData.mainnet.address
    : null;
});

// IPC handler to get Bitcoin address for testnet
ipcMain.handle("get-bitcoin-address-testnet", async () => {
  return bitcoinWalletData && bitcoinWalletData.testnet
    ? bitcoinWalletData.testnet.address
    : null;
});

// IPC handler to get Ethereum address
ipcMain.handle("get-ethereum-address", async () => {
  return ethereumWalletData ? ethereumWalletData.address : null;
});

// IPC handler to get config
ipcMain.handle("get-config", async () => {
  if (fs.existsSync(configFile)) {
    return JSON.parse(fs.readFileSync(configFile));
  } else {
    return null;
  }
});

// IPC handler to set config
ipcMain.handle("set-config", async (event, newConfig) => {
  updateConfigFile(newConfig);
  return true;
});

// Helper to fetch UTXOs from Blockstream API
async function fetchUtxos(address, apiBase) {
  try {
    const res = await fetch(`${apiBase}/address/${address}/utxo`);
    if (!res.ok) {
      throw new Error(`Failed to fetch UTXOs: ${res.status} ${res.statusText}`);
    }
    const utxos = await res.json();
    return utxos;
  } catch (error) {
    console.error("Error fetching UTXOs:", error);
    throw error;
  }
}

// Helper to fetch raw transaction from Blockstream API
async function fetchRawTransaction(txid, apiBase) {
  try {
    const res = await fetch(`${apiBase}/tx/${txid}/raw`);
    if (!res.ok) {
      throw new Error(
        `Failed to fetch raw transaction: ${res.status} ${res.statusText}`
      );
    }
    return await res.text();
  } catch (error) {
    console.error("Error fetching raw transaction:", error);
    throw error;
  }
}

// Helper to broadcast raw tx to Blockstream API
async function broadcastTx(rawTxHex, apiBase) {
  try {
    const res = await fetch(`${apiBase}/tx`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: rawTxHex,
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(
        `Failed to broadcast transaction: ${res.status} ${res.statusText} - ${errorText}`
      );
    }
    const txid = await res.text();
    return txid;
  } catch (error) {
    console.error("Error broadcasting transaction:", error);
    throw error;
  }
}

// IPC handler to send Bitcoin
ipcMain.handle("send-bitcoin", async (_event, args) => {
  const { network, recipientAddress, amountBtc, fee } = args;

  const response = await executeBitcoinTransaction({
    network,
    recipientAddress,
    amountBtc,
    fee,
  });

  return response;
});

// IPC handler to send Ethereum
ipcMain.handle("send-ethereum", async (_event, args) => {
  try {
    const { network, recipientAddress, amountEth, gasLimit, gasPrice } = args;

    const response = await sendEthereumTransaction({
      network,
      recipientAddress,
      amountEth,
      gasPrice,
      gasLimit,
    });

    return response;
  } catch (err) {
    console.error("Ethereum send error:", err);
    return { error: err.message || String(err) };
  }
});

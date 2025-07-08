const { Psbt, networks } = require("bitcoinjs-lib");
const { ECPairFactory } = require("ecpair");
const ecc = require("tiny-secp256k1");
const fs = require("fs");
const path = require("path");

const ECPair = ECPairFactory(ecc);

const bitcoinWalletFile = path.join(__dirname, "../bitcoin_wallet.json");

async function broadcastRawTransaction(rawTxHex, network) {
  // Load your config to get apiBase
  const configFile = path.join(__dirname, "../config.json");
  const configRaw = fs.readFileSync(configFile, "utf-8");
  const config = JSON.parse(configRaw);

  const apiBase =
    network === "mainnet"
      ? config.mainnet.bitcoin.apiBase
      : config.testnet.bitcoin.apiBase;

  // Broadcast to Blockstream
  const response = await fetch(`${apiBase}/tx`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: rawTxHex,
  });
  return response;
}

async function createAndSignTransaction(params) {
  try {
    const { network, recipientAddress, amountBtc, fee } = params;

    // Select wallet file based on network
    let bitcoinWalletFile = "";
    if (network === "mainnet") {
      bitcoinWalletFile = path.join(__dirname, "../bitcoin_wallet_mainnet.json");
    } else {
      bitcoinWalletFile = path.join(__dirname, "../bitcoin_wallet_testnet.json");
    }

    let bitcoinWalletData = { privateKey: "", address: "" };
    if (fs.existsSync(bitcoinWalletFile)) {
      bitcoinWalletData = JSON.parse(
        fs.readFileSync(bitcoinWalletFile, "utf-8")
      );
    } else {
      throw new Error(`Bitcoin wallet file not found for network: ${network}`);
    }

    const address = bitcoinWalletData.address;
    const privateKey = bitcoinWalletData.privateKey;

    const configFile = path.join(__dirname, "../config.json");
    const configRaw = fs.readFileSync(configFile, "utf-8");
    const config = JSON.parse(configRaw);

    const apiBase =
      network === "mainnet"
        ? config.mainnet.bitcoin.apiBase
        : config.testnet.bitcoin.apiBase;

    const bitcoinNetwork =
      network === "mainnet" ? networks.bitcoin : networks.testnet;

    const keyPair = ECPair.fromWIF(privateKey, bitcoinNetwork);

    const utxosResponse = await fetch(`${apiBase}/address/${address}/utxo`);
    if (!utxosResponse.ok) {
      throw new Error(`Failed to fetch UTXOs: HTTP ${utxosResponse.status}`);
    }
    const utxos = await utxosResponse.json();

    if (!Array.isArray(utxos) || utxos.length === 0) {
      throw new Error("No UTXOs found for this address.");
    }

    const psbt = new Psbt({ network: bitcoinNetwork });

    let totalInput = 0;

    for (const utxo of utxos) {
      const txResponse = await fetch(`${apiBase}/tx/${utxo.txid}`);
      if (!txResponse.ok) {
        throw new Error(
          `Failed to fetch transaction ${utxo.txid}: HTTP ${txResponse.status}`
        );
      }
      const txData = await txResponse.json();
      const voutData = txData.vout[utxo.vout];
      if (!voutData) {
        throw new Error(
          `Invalid vout index ${utxo.vout} for txid ${utxo.txid}`
        );
      }
      const scriptPubKey = voutData.scriptpubkey;
      const value = Math.round(Number(voutData.value));

      psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        witnessUtxo: {
          script: Buffer.from(scriptPubKey, "hex"),
          value,
        },
      });

      totalInput += value;
    }

    const amountSats = Math.round(amountBtc * 1e8);

    if (totalInput < amountSats + fee) {
      throw new Error(
        `Insufficient funds: have ${totalInput} sats, need ${
          amountSats + fee
        } sats`
      );
    }

    psbt.addOutput({
      address: recipientAddress,
      value: amountSats,
    });

    const change = totalInput - amountSats - fee;

    if (change > 0) {
      psbt.addOutput({
        address,
        value: change,
      });
    }

    for (let i = 0; i < utxos.length; i++) {
      psbt.signInput(i, {
        publicKey: Buffer.from(keyPair.publicKey),
        sign: (hash) => Buffer.from(keyPair.sign(hash)),
      });
    }

    try {
      psbt.finalizeAllInputs();
    } catch (err) {
      console.error("error in finaliuze all inputs");
    }

    const rawTxHex = psbt.extractTransaction().toHex();
    return rawTxHex;
  } catch (err) {
    console.error("Error in createAndSignTransaction:", err);
    throw err;
  }
}

async function executeBitcoinTransaction(params) {
  const { network, recipientAddress, amountBtc, fee } = params;
  const rawTxHex = await createAndSignTransaction({
    network: network,
    recipientAddress: recipientAddress,
    amountBtc: amountBtc,
    fee: fee,
  });
  const response = await broadcastRawTransaction(rawTxHex, network);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Broadcast failed: HTTP ${response.status} ${text}`);
  }
  return {
    txid: text,
    status: response.status,
  };
}

module.exports = { executeBitcoinTransaction };

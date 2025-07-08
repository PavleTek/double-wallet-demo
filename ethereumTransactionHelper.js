const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

async function sendEthereumTransaction(params) {
  const { network, recipientAddress, amountEth, gasPrice, gasLimit } = params;

  const walletFile = path.join(__dirname, "../ethereum_wallet.json");
  if (!fs.existsSync(walletFile)) {
    throw new Error("Ethereum wallet file not found.");
  }
  const walletData = JSON.parse(fs.readFileSync(walletFile, "utf-8"));
  const privateKey = walletData.privateKey;

  const configFile = path.join(__dirname, "../config.json");
  const config = JSON.parse(fs.readFileSync(configFile, "utf-8"));

  const rpcUrl =
    network === "mainnet"
      ? config.mainnet.ethereum.rpcUrl
      : config.testnet.ethereum.rpcUrl;

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  let finalGasPrice;
  if (gasPrice !== undefined && gasPrice !== null) {
    finalGasPrice = ethers.parseUnits(gasPrice.toString(), "gwei");
  } else {
    finalGasPrice = await provider.getGasPrice();
  }

  const tx = {
    to: recipientAddress,
    value: ethers.parseEther(amountEth.toString()),
    gasPrice: finalGasPrice,
    gasLimit: gasLimit ?? 21000
  };

  const sentTx = await wallet.sendTransaction(tx);

  return {
    txid: sentTx.hash,
    status: "broadcast"
  };
}


module.exports = { sendEthereumTransaction };

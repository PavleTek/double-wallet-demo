# Double Wallet

This project is a simpel double wallet, that serves for both Bitcoin and Ethereum.

## Install and run
You can clone the repository from github git@github.com:PavleTek/double-wallet-demo.git
To run the app locally you need to run the following commands command:
```bash
npm install
npm run electron
```


## Package Electron and use wallet in a usb stick
You can package the electorn app and paste the folder inside of a usb stick
This will allow you to use the same wallet on different computers
It is important to notice that the wallet has no password, and no security features.
A computer could instantly copy all the info from the usb stick and have access to your wallet
You can use this wallet as you wish, but it is not recommended. it was made purely for educational purposes

to package the app run:
```bash
npm build-electron
```

This will create a folder called "release-build" with another folder called "DoubleWallet-win32-x64"
Copy and paste this to any usb stick.
after pasting in the usb stick, inside of the drive, you can open the folder and click on the
"DoubleWallet.exe" file. which will launch the app.
Once the app is launched it will create the wallets for bitcoin and ethereum inside of the
"resources" folder. these will contain your private key and address. deleting this will imply losing all 
the currency inside


## Using the wallet
If you want to use the wallet, even though it is not secure.
for bitcoin everything is ready for as long as: https://blockstream.info/ is online

If you want to use the ethereum wallet, you need to click on the bottom right corner, on the settings button
and change the string "PASTE_YOUR_API_KEY_HERE" with an API key from https://www.infura.io/
You can get a key for free, and even if you frecuently transact with ethereum you will probably not run out of credits for it

## Testnet.
you can change to testnet in the settings, this will use a secondary bitcoin address that you can use for testing. Ethereum address will remain the same, since it already requires you to have some ethereum in there already to get "testing ethereum" from a faucet sadly

## Future
hopefully this can one day be an open source wallet that everyone can have on a usb stick. security, transaction history, better settings, unit and end to end testing, certificates for easier destribution, etc...

// Angular Core imports
import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  HostListener,
} from '@angular/core';

// PrimeNg imports
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { Toast } from 'primeng/toast';
import { MessageService, ConfirmationService } from 'primeng/api';
import { DropdownModule } from 'primeng/dropdown';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
import { DividerModule } from 'primeng/divider';
// Functional Imports
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

declare global {
  interface Window {
    require: any;
  }
}

@Component({
  selector: 'app-root',
  imports: [
    Toast,
    ButtonModule,
    InputTextModule,
    CommonModule,
    FormsModule,
    InputNumberModule,
    DropdownModule,
    ConfirmDialog,
    DividerModule,
    TooltipModule,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  @ViewChild('settingsSection', { static: false }) settingsSection!: ElementRef;

  constructor(
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) {}
  protected title = 'Wallet';
  bitcoinAddress: string = '';
  ethereumAddress: string = '';
  recipientAddress: string = '';
  statusMessage: string = '';
  amount: number = 0;
  sendBitcoinFee: number = 25;

  // Balance properties
  bitcoinBalance: string = 'Loading...';
  ethereumBalance: string = 'Loading...';

  // Config editor properties
  selectedNetwork: 'testnet' | 'mainnet' = 'mainnet';
  pendingNetwork: 'testnet' | 'mainnet' = 'mainnet';
  configDraft: any = {
    bitcoinFee: 25,
    gasLimit: 21000,
    gasPrice: 20,
    testnet: {
      bitcoin: { apiBase: '' },
      ethereum: { network: '', rpcUrl: '' },
    },
    mainnet: {
      bitcoin: { apiBase: '' },
      ethereum: { network: '', rpcUrl: '' },
    },
  };

  showNetworkSettings = false;

  bitcoinRecipient: string = '';
  bitcoinAmount: number = 0;
  ethereumRecipient: string = '';
  ethereumAmount: number = 0;

  gasLimit: number = 21000;
  defaultGasLimit: number = 21000;
  gasPrice: number = 20;
  defaultGasPrice: number = 20;
  recommendedGasPrice: number = 0;
  isLoadingGasPrice: boolean = false;

  // Closes the settings section after pressing escape
  @HostListener('document:keydown.escape')
  onEscapePress() {
    if (this.showNetworkSettings) {
      this.showNetworkSettings = false;
    }
  }

  @HostListener('document:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent) {
    if (this.showNetworkSettings && event.ctrlKey && event.key === 'Enter') {
      this.saveConfig();
    }
  }

  // should be fixed or deleted, for now leaving as is
  async toggleNetworkSettings() {
    this.showNetworkSettings = !this.showNetworkSettings;

    // If opening settings, reload config to reset unsaved changes
    if (this.showNetworkSettings) {
      if ((window as any).require) {
        const { ipcRenderer } = window.require('electron');
        const config = await ipcRenderer.invoke('get-config');
        if (config) {
          this.configDraft = JSON.parse(JSON.stringify(config));
          if (config.gasLimit) {
            this.defaultGasLimit = config.gasLimit;
            this.gasLimit = config.gasLimit;
          }
          if (config.gasPrice) {
            this.defaultGasPrice = config.gasPrice;
            this.gasPrice = config.gasPrice;
          }
        }
      }
      setTimeout(() => {
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: 'smooth',
        });
      }, 100); // Small delay to ensure the settings section is rendered
    }
  }

  networkOptions = [
    { label: 'Testnet', value: 'testnet' },
    { label: 'Mainnet', value: 'mainnet' },
  ];

  // Gets the corresponding address for main and test bitcoin networks
  async fetchBitcoinAddressForNetwork(network: 'mainnet' | 'testnet') {
    if ((window as any).require) {
      const { ipcRenderer } = window.require('electron');
      let handler = '';
      if (network === 'mainnet') handler = 'get-bitcoin-address-mainnet';
      if (network === 'testnet') handler = 'get-bitcoin-address-testnet';
      const address = await ipcRenderer.invoke(handler);
      this.bitcoinAddress = address || '';
    }
  }

  // Gets Bitcoin balance
  async fetchBitcoinBalance() {
    try {
      if (!this.bitcoinAddress) return;

      const config = await this.getCurrentConfig();
      const apiBase = config[this.selectedNetwork].bitcoin.apiBase;

      const response = await fetch(`${apiBase}/address/${this.bitcoinAddress}`);
      const data = await response.json();

      // Calculate balance from chain_stats and mempool_stats
      const confirmedBalance =
        data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum;
      const unconfirmedBalance =
        data.mempool_stats.funded_txo_sum - data.mempool_stats.spent_txo_sum;
      const totalBalance = confirmedBalance + unconfirmedBalance;

      this.bitcoinBalance = `${(totalBalance / 100000000).toFixed(8)} BTC`;
    } catch (error) {
      console.error('Error fetching Bitcoin balance:', error);
      this.bitcoinBalance = 'Error loading balance';
    }
  }

  // Gets Ethereum Balance
  async fetchEthereumBalance() {
    try {
      if (!this.ethereumAddress) return;

      const config = await this.getCurrentConfig();
      const rpcUrl = config[this.selectedNetwork].ethereum.rpcUrl;

      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getBalance',
          params: [this.ethereumAddress, 'latest'],
          id: 1,
        }),
      });

      const data = await response.json();
      const balanceWei = parseInt(data.result, 16);
      const balanceEth = balanceWei / Math.pow(10, 18);

      this.ethereumBalance = `${balanceEth.toFixed(6)} ETH`;
    } catch (error) {
      console.error('Error fetching Ethereum balance:', error);
      this.ethereumBalance = 'Error loading balance';
    }
  }

  // Gets the recommended gas price to effectuate ethereum transaction
  async fetchRecommendedGasPrice() {
    try {
      this.isLoadingGasPrice = true;

      const config = await this.getCurrentConfig();
      const rpcUrl = config[this.selectedNetwork].ethereum.rpcUrl;

      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_gasPrice',
          params: [],
          id: 1,
        }),
      });

      const data = await response.json();

      if (data.result) {
        // Convert from hex to decimal, then from wei to gwei
        const gasPriceWei = parseInt(data.result, 16);
        this.recommendedGasPrice = gasPriceWei / Math.pow(10, 9); // Convert wei to gwei
      } else if (data.error) {
        console.error('Error fetching gas price:', data.error);
        this.messageService.add({
          severity: 'error',
          summary: 'Gas Price Error',
          detail: `Failed to fetch recommended gas price: ${data.error.message}`,
          life: 3000,
        });
      }
    } catch (error) {
      console.error('Error fetching recommended gas price:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Gas Price Error',
        detail: 'Failed to fetch recommended gas price',
        life: 3000,
      });
    } finally {
      this.isLoadingGasPrice = false;
    }
  }

  // gets config
  async getCurrentConfig() {
    if ((window as any).require) {
      const { ipcRenderer } = window.require('electron');
      return await ipcRenderer.invoke('get-config');
    }
    return null;
  }

  ngOnInit() {
    if ((window as any).require) {
      const { ipcRenderer } = window.require('electron');
      this.fetchBitcoinAddressForNetwork(this.selectedNetwork).then(() => {
        if (this.bitcoinAddress) {
          this.fetchBitcoinBalance();
        }
      });
      ipcRenderer.invoke('get-ethereum-address').then((address: string) => {
        if (address) {
          this.ethereumAddress = address;
          this.fetchEthereumBalance(); // Fetch balance after getting address
        }
      });
      // Load config
      ipcRenderer.invoke('get-config').then((config: any) => {
        if (config) {
          this.configDraft = JSON.parse(JSON.stringify(config));
          this.sendBitcoinFee = config.bitcoinFee;
          // Set selectedNetwork to mainnet by default, or testnet if mainnet doesn't exist
          if (config.mainnet) {
            this.selectedNetwork = 'mainnet';
            this.pendingNetwork = 'mainnet';
          } else if (config.testnet) {
            this.selectedNetwork = 'testnet';
            this.pendingNetwork = 'testnet';
          }
          if (config.gasLimit) {
            this.defaultGasLimit = config.gasLimit;
            this.gasLimit = config.gasLimit;
          }
          if (config.gasPrice) {
            this.defaultGasPrice = config.gasPrice;
            this.gasPrice = config.gasPrice;
          }
        }
      });
    } else {
    }
  }

  // For edditing config
  saveConfig() {
    if ((window as any).require) {
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.invoke('set-config', this.configDraft).then(() => {
        this.messageService.add({
          severity: 'success',
          summary: 'Config Saved',
          detail: 'Configuration updated successfully.',
          life: 3000,
        });
      });
      this.configDraft.gasLimit = this.defaultGasLimit;
    }
  }

  // Copy function
  copyToClipboard(adress: string, typeOfCrypto: string) {
    navigator.clipboard.writeText(adress);
    this.messageService.add({
      severity: 'success',
      summary: 'Copied',
      detail: `Your ${typeOfCrypto} Address Was Copied`,
      life: 3000,
    });
  }

  // Sends bitcoin
  // Should Refactor message service mess
  async sendBitcoin() {
    try {
      if (
        !this.bitcoinRecipient ||
        !this.bitcoinAmount ||
        this.bitcoinAmount <= 0
      ) {
        this.statusMessage =
          'Please enter a valid recipient address and amount.';
        this.messageService.add({
          severity: 'warn',
          summary: 'Invalid Input',
          detail: 'Please enter a valid recipient address and amount.',
          life: 3000,
        });
        return;
      }

      this.statusMessage = 'Sending Bitcoin...';
      this.messageService.add({
        severity: 'info',
        summary: 'Sending',
        detail: 'Sending Bitcoin transaction...',
        life: 3000,
      });

      if ((window as any).require) {
        const { ipcRenderer } = window.require('electron');

        const response = await ipcRenderer.invoke('send-bitcoin', {
          network: this.selectedNetwork,
          recipientAddress: this.bitcoinRecipient,
          amountBtc: this.bitcoinAmount,
          fee: this.sendBitcoinFee,
        });

        if (response && response.txid) {
          this.statusMessage = `Bitcoin sent! Transaction ID: ${response.txid}`;
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: `Bitcoin sent! Transaction ID: ${response.txid}`,
            life: 5000,
          });
          this.fetchBitcoinBalance();
          this.bitcoinRecipient = '';
          this.bitcoinAmount = 0;
        } else if (response && response.error) {
          this.statusMessage = `Error: ${response.error}`;
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: this.statusMessage,
            life: 5000,
          });
        } else {
          this.statusMessage = 'Error: Unknown response from backend.';
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: this.statusMessage,
            life: 5000,
          });
        }
      } else {
        this.statusMessage = 'Not running in Electron.';
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Not running in Electron.',
          life: 5000,
        });
      }
    } catch (err: any) {
      this.statusMessage = `Unexpected error: ${
        err && err.message ? err.message : err
      }`;
      this.messageService.add({
        severity: 'error',
        summary: 'Unexpected Error',
        detail: this.statusMessage,
        life: 5000,
      });
    }
  }

  // Sends ethereum
  // Should Refactor message service mess
  async sendEthereum() {
    try {
      if (
        !this.ethereumRecipient ||
        !this.ethereumAmount ||
        this.ethereumAmount <= 0
      ) {
        this.statusMessage =
          'Please enter a valid recipient address and amount.';
        this.messageService.add({
          severity: 'warn',
          summary: 'Invalid Input',
          detail: 'Please enter a valid recipient address and amount.',
          life: 3000,
        });
        return;
      }

      this.statusMessage = 'Sending Ethereum...';
      this.messageService.add({
        severity: 'info',
        summary: 'Sending',
        detail: 'Sending Ethereum transaction...',
        life: 3000,
      });

      if ((window as any).require) {
        const { ipcRenderer } = window.require('electron');

        const response = await ipcRenderer.invoke('send-ethereum', {
          network: this.selectedNetwork,
          recipientAddress: this.ethereumRecipient,
          amountEth: this.ethereumAmount,
          gasPrice: this.gasPrice,
          gasLimit: this.gasLimit,
        });

        if (response && response.txid) {
          this.statusMessage = `Ethereum sent! Transaction ID: ${response.txid}`;
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: `Ethereum sent! Transaction ID: ${response.txid}`,
            life: 5000,
          });
          this.fetchEthereumBalance();
          this.ethereumRecipient = '';
          this.ethereumAmount = 0;
          this.gasLimit = this.defaultGasLimit;
        } else if (response && response.error) {
          this.statusMessage = `Error: ${response.error}`;
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: this.statusMessage,
            life: 5000,
          });
        } else {
          this.statusMessage = 'Error: Unknown response from backend.';
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: this.statusMessage,
            life: 5000,
          });
        }
      } else {
        this.statusMessage = 'Not running in Electron.';
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Not running in Electron.',
          life: 5000,
        });
      }
    } catch (err: any) {
      this.statusMessage = `Unexpected error: ${
        err && err.message ? err.message : err
      }`;
      this.messageService.add({
        severity: 'error',
        summary: 'Unexpected Error',
        detail: this.statusMessage,
        life: 5000,
      });
    }
  }

  // Method to refresh balances when network changes
  async refreshBalances() {
    await this.fetchBitcoinBalance();
    await this.fetchEthereumBalance();
    await this.fetchRecommendedGasPrice();
  }

  onNetworkDropdownChange(event: any) {
    const newNetwork = event.value;
    if (newNetwork === this.selectedNetwork) return;
    this.confirmationService.confirm({
      message:
        newNetwork === 'testnet'
          ? 'Changing to testnet is for development only. Are you sure?'
          : 'Are you sure you want to switch networks?',
      header: 'Confirm Network Change',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.selectedNetwork = newNetwork;
        this.fetchBitcoinAddressForNetwork(this.selectedNetwork).then(() => {
          this.refreshBalances();
        });
      },
      reject: () => {
        this.pendingNetwork = this.selectedNetwork;
      },
    });
  }
}

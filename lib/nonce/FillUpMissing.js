/**
 * This script is used to fill the missing nonce.
 *
 * @module executables/fire_brigade/fill_up_missing_nonce
 */
const Buffer = require('safe-buffer').Buffer,
  Tx = require('ethereumjs-tx');

const rootPrefix = '../..',
  AddressPrivateKeyCache = require(rootPrefix + '/lib/sharedCacheManagement/AddressPrivateKey'),
  CustomWebProvider = require(rootPrefix + '/lib/nonce/CustomWebProvider');

class FillUpMissingNonce {
  /**
   * parameters
   *
   * @param {object} params - external passed parameters
   * @param {String} params.fromAddress - from_address
   * @param {String} params.toAddress - to_address
   * @param {String} params.chainClient - chain_type (geth | parity)
   * @param {Integer} params.missingNonce - missing_nonce
   * @param {String} params.gethProvider - geth_provider (WS | RPC)
   * @param {String} params.gasPrice - gas_price
   *
   *
   */
  constructor(params) {
    const oThis = this;

    oThis.fromAddress = params.fromAddress.toLowerCase();
    oThis.toAddress = params.toAddress.toLowerCase();
    oThis.chainClient = params.chainClient;
    oThis.missingNonce = params.missingNonce;
    oThis.provider = params.gethProvider;
    oThis.gasPrice = params.gasPrice;
    oThis.privateKeyObj = null;
    oThis.rawTx = null;
  }

  async perform() {
    const oThis = this;

    await oThis.initializeRawTx();

    await oThis.setPrivateKey();

    await oThis.sendSignedTx();
  }

  initializeRawTx() {
    const oThis = this;

    oThis.rawTx = {
      from: oThis.fromAddress,
      to: oThis.toAddress,
      value: '0x1',
      gasPrice: oThis.gasPrice,
      gas: 25000,
      nonce: oThis.missingNonce
    };

    return Promise.resolve();
  }

  async setPrivateKey() {
    const oThis = this,
      fetchPrivateKeyObj = new AddressPrivateKeyCache({ address: oThis.fromAddress }),
      fetchPrivateKeyRsp = await fetchPrivateKeyObj.fetchDecryptedData();

    if (fetchPrivateKeyRsp.isFailure()) {
      throw 'private key not found';
    }

    // get private key - this should be the private key without 0x at the beginning.
    let privateKey = fetchPrivateKeyRsp.data['private_key_d'];
    if (privateKey.slice(0, 2).toLowerCase() === '0x') {
      privateKey = privateKey.substr(2);
    }

    oThis.privateKeyObj = new Buffer(privateKey, 'hex');

    return Promise.resolve();
  }

  sendSignedTx() {
    const oThis = this;

    const tx = new Tx(oThis.rawTx);

    tx.sign(oThis.privateKeyObj);

    const serializedTx = tx.serialize();

    const providerObj = CustomWebProvider.getInstance(oThis.provider, oThis.chainClient);

    return providerObj.eth
      .sendSignedTransaction('0x' + serializedTx.toString('hex'))
      .once('transactionHash', function(txHash) {
        console.log('transaction_hash:', txHash);
      })
      .once('receipt', function(receipt) {
        console.log('receipt:', receipt);
      })
      .on('error', function(error) {
        console.log('error:', error);
      });
  }
}

module.exports = FillUpMissingNonce;

/*

Below is an example how to use this script on console
========================================================================

FillUp = require('./lib/nonce/FillUpMissing');
fillUp = new FillUp({
  fromAddress: '0x6e3aa191573B255C82B0192566d82235aadf8b86',
  toAddress: '0x616F76d7e749a68b24f5449bcA520f30CA0F7Aa6',
  chainClient: 'geth',
  missingNonce: 18,
  gethProvider: 'ws://127.0.0.1:9546',
  gasPrice: '0x3B9ACA00'
});

fillUp.perform().then(console.log);

*/
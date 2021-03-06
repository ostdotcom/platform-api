'use strict';

const abiDecoder = require('abi-decoder'),
  MosaicJs = require('@openst/mosaic.js'),
  OpenSTJs = require('@openst/openst.js'),
  mosaicJsAbiBinProvider = new MosaicJs.AbiBinProvider(),
  OpenSTJsAbiBinProvider = new OpenSTJs.AbiBinProvider(),
  BrandedToken = require('@openst/brandedtoken.js'),
  brandedTokenAbiBinProvider = new BrandedToken.AbiBinProvider(),
  web3 = require('web3');

const EIP20GatewayAbi = mosaicJsAbiBinProvider.getABI('EIP20Gateway'),
  EIP20CoGatewayAbi = mosaicJsAbiBinProvider.getABI('EIP20CoGateway'),
  AnchorAbi = mosaicJsAbiBinProvider.getABI('Anchor'),
  TokenHolderAbi = OpenSTJsAbiBinProvider.getABI('TokenHolder'),
  GatewayComposerAbi = brandedTokenAbiBinProvider.getABI('GatewayComposer'),
  BrandedTokenAbi = brandedTokenAbiBinProvider.getABI('BrandedToken'),
  CoGatewayAbi = brandedTokenAbiBinProvider.getABI('CoGatewayUtilityTokenInterface'),
  UtilityBrandedTokenAbi = brandedTokenAbiBinProvider.getABI('UtilityBrandedToken'),
  DelayedRecoveryModuleAbi = OpenSTJsAbiBinProvider.getABI('DelayedRecoveryModule'),
  UserWalletFactoryAbi = OpenSTJsAbiBinProvider.getABI('UserWalletFactory'),
  ProxyFactoryAbi = OpenSTJsAbiBinProvider.getABI('ProxyFactory'),
  GnosisSafeAbi = OpenSTJsAbiBinProvider.getABI('GnosisSafe');

abiDecoder.addABI(EIP20GatewayAbi);
abiDecoder.addABI(EIP20CoGatewayAbi);
abiDecoder.addABI(AnchorAbi);
abiDecoder.addABI(TokenHolderAbi);
abiDecoder.addABI(GatewayComposerAbi);
abiDecoder.addABI(BrandedTokenAbi);
abiDecoder.addABI(UtilityBrandedTokenAbi);
abiDecoder.addABI(CoGatewayAbi);

abiDecoder.addABI(DelayedRecoveryModuleAbi);
abiDecoder.addABI(UserWalletFactoryAbi);
abiDecoder.addABI(ProxyFactoryAbi);
abiDecoder.addABI(GnosisSafeAbi);

class GetTxData {
  constructor(params) {
    const oThis = this;
    oThis.txHash = params.txHash;
    oThis.web3ProviderUrl = params.web3ProviderUrl;
  }

  async getDecodedInputParams() {
    const oThis = this;
    let web3Provider = new web3(oThis.web3ProviderUrl);
    let txData = await web3Provider.eth.getTransaction(oThis.txHash);
    console.log('-txData---->', JSON.stringify(txData));

    let decodedData = abiDecoder.decodeMethod(txData.input);
    console.log('-decodedInputData---->', JSON.stringify(decodedData));
    return decodedData;
  }

  async getDecodedEvents() {
    const oThis = this;
    const web3Provider = new web3(oThis.web3ProviderUrl);
    const receipt = await web3Provider.eth.getTransactionReceipt(oThis.txHash);
    console.log('-receipt---->', JSON.stringify(receipt));

    let decodedEvents = abiDecoder.decodeLogs(receipt.logs);
    console.log('-decodedEvents---->', JSON.stringify(decodedEvents));
    return decodedEvents;
  }
}

module.exports = GetTxData;

/*

txD = require('./tests/getTxData')
txO = new txD({
  txHash: '0xfbd194a271a9a82c1739c8dd96511eaebd64842cf2bee2b1c9a01acd76862188',
  web3ProviderUrl: 'ws://s6-sb-c199-r1.stagingost.com:8551'
})

txO.getDecodedInputParams().then(console.log);
txO.getDecodedEvents().then(function(q){r=q})

*/

/**
 * For generating report for stake and mint
 * @type {any}
 */
// let txD = require('./tests/getTxData');
// let originWsProvider = 'ws://s5-mn-o3-r1.stagingost.com:8546';
// let auxWsProvider = 'ws://s5-mn-c201-r1.stagingost.com:8551';
//
// let getProvider = function(chain) {
//   return chain == 'aux' ? auxWsProvider:originWsProvider;
// };
//
// let txHashes = {
//   'proveGatewayOnCoGateway': {
//     chain: 'aux',
//     transactionHash: '0xcf7bfa90edd8007218e1f7fecb1704a8bac979bcedf8b87753fdff0eeecd0230'
//   },
//   confirmStakeIntent: {
//     chain: 'aux',
//     transactionHash: '0xa4e674d6915712857d576123ecc7d96f01d5bc4fd46f3a2597f761176f753c09'
//   },
//   approveGatewayComposer: {
//     chain: 'origin',
//     transactionHash: '0x21410189aa13ac2c9bed7359acd226e8b6938a631d7a2e572b2d92f70ae73a50'
//   },
//   requestStake: {
//     chain: 'origin',
//     transactionHash: '0x33478d3f5bcc803c1edba7f9d1fd93b4a2d725e59481fa620bb99edb88e34441'
//   },
//   acceptStake: {
//     chain: 'origin',
//     transactionHash: '0xd65407d793fffc7293075a45316e876f7f27fcb1d1773ddf0307f9c555d8458f'
//   },
//   commitStateRoot: {
//     chain: 'aux',
//     transactionHash: '0xf123d4eea0a008d0bbb981041b1e35a7782e9a95402390af4548e33111402dc7'
//   }
// };
//
// let reportData = {};
// let promiseArray = [];
//
// for(let step in txHashes) {
//   reportData[step] = {
//     inputParams: null,
//     events: null
//   };
//   let stepDetails = txHashes[step];
//   let provider = getProvider(stepDetails.chain);
//
//   let txO = new txD({
//     txHash: stepDetails.transactionHash,
//     web3ProviderUrl: provider
//   });
//
//   let p1 = txO.getDecodedInputParams().then(
//     function (inputParams) {
//       reportData[step].inputParams = inputParams;
//     }
//   );
//
//   promiseArray.push(p1);
//
//   let p2 = txO.getDecodedEvents().then(
//     function (events) {
//       reportData[step].events = events;
//     }
//   );
//
//   promiseArray.push(p2);
// }
//
// Promise.all(promiseArray).then(function() {
//   console.log(reportData);
// });

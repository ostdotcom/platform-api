'use strict';

const rootPrefix = '../..',
  chainConfigProvider = require(rootPrefix + '/lib/providers/chainConfig'),
  contractConstants = require(rootPrefix + '/lib/globalConstant/contract'),
  gasPriceCacheKlass = require(rootPrefix + '/lib/sharedCacheManagement/EstimateOriginChainGasPrice');

class TransferEth {
  /**
   *
   * @param params
   */
  constructor(params) {
    const oThis = this;
    oThis.originChainId = params.originChainId;
    oThis.transferDetails = params.transferDetails;

    oThis.balances = {};
    oThis.originGasPrice = null;
    oThis.gas = contractConstants.transferEthGas;
  }

  async perform() {
    const oThis = this;

    await oThis._setWeb3Instance();

    await oThis._initializeVars();

    await oThis._fundAddress();

    return oThis.balances;
  }

  async _setWeb3Instance() {
    const oThis = this;

    let response = await chainConfigProvider.getFor([oThis.originChainId]),
      originChainConfig = response[oThis.originChainId];

    oThis.originWsProvider = originChainConfig.originGeth.readOnly.wsProviders[0];
  }

  async _initializeVars() {
    const oThis = this;

    let gasPriceCacheObj = new gasPriceCacheKlass(),
      gasPriceRsp = await gasPriceCacheObj.fetch();

    oThis.originGasPrice = gasPriceRsp.data;
  }

  /**
   * Fund address
   *
   * @param address
   * @param amount
   * @return {Promise<void>}
   * @private
   */
  async _fundAddress(address, amount) {
    const oThis = this,
      promiseArray = [];

    for (let i = 0; i < oThis.transferDetails.length; i++) {
      let transferDeta = oThis.transferDetails[i];
      let txOptions = {
        from: transferDeta.from,
        to: transferDeta.to,
        value: transferDeta.amountInWei,
        gas: oThis.gas,
        gasPrice: oThis.originGasPrice
      };

      let params = {
        chainId: oThis.originChainId,
        provider: oThis.originWsProvider,
        waitTillReceipt: 1,
        txOptions: txOptions
      };

      promiseArray.push(
        new SubmitTransaction(params)
          .perform()
          .then(function(txResponse) {
            logger.info('===Success Transfer eth --- for ', txOptions, '\n------ response ---', txResponse);
          })
          .cache(function(err) {
            logger.info('===Failed Transfer eth --- for ', txOptions, '\n------ response ---', err);
          })
      );
    }

    return Promise.all(promiseArray);
  }
}

module.exports = TransferEth;
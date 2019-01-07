'use strict';

/**
 * This service recovers the account that signed the message and
 * checks if it matches with the account provided in the argument.
 *
 *
 * @module app/services/signer/Signer
 */

const rootPrefix = '../../..',
  logger = require(rootPrefix + '/lib/logger/customConsoleLogger'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  OSTBase = require('@openstfoundation/openst-base'),
  coreConstants = require(rootPrefix + '/config/coreConstants'),
  ConfigStrategyHelper = require(rootPrefix + '/helpers/configStrategy/ByChainId'),
  configStrategyConstants = require(rootPrefix + '/lib/globalConstant/configStrategy'),
  web3Provider = require(rootPrefix + '/lib/providers/web3');

const InstanceComposer = OSTBase.InstanceComposer;

class Signer {
  /**
   *
   *
   * @param params
   */
  constructor(params) {
    const oThis = this;

    oThis.signer = params.signer.toLowerCase();
    oThis.personalSign = params.personal_sign;
    oThis.messageToSign = params.message_to_sign;
  }

  /**
   *
   * @return {Promise<>}
   */
  perform() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(error) {
      if (responseHelper.isCustomResult(error)) {
        return error;
      } else {
        logger.error('app/services/signer/signer::perform::catch');
        logger.error(error);
        return responseHelper.error({
          internal_error_identifier: 'l_ar_ecr_1',
          api_error_identifier: 'unhandled_catch_response',
          debug_options: {}
        });
      }
    });
  }

  /**
   *
   *
   * @return {Promise<any>}
   */
  async asyncPerform() {
    const oThis = this;

    oThis._validateParameters();

    let providers = await oThis._getProvidersFromConfig(),
      provider = providers.data[0], //select one provider from provider endpoints array
      web3Instance = web3Provider.getInstance(provider).web3WsProvider;

    logger.debug('provider------', provider);

    let accountAddress = await web3Instance.eth.personal.ecRecover(oThis.messageToSign, oThis.personalSign);

    if (!accountAddress) {
      return Promise.resolve(
        responseHelper.error({
          internal_error_identifier: 'l_ar_ecr_2',
          api_error_identifier: 'invalid_address',
          error_config: {}
        })
      );
    }

    if (oThis.signer != accountAddress) {
      logger.error('Input owner address does not matches recovered address');
      return Promise.resolve(
        responseHelper.error({
          internal_error_identifier: 'l_ar_ecr_5',
          api_error_identifier: 'invalid_address',
          error_config: {}
        })
      );
    }

    logger.log('Input owner address matches with recovered address');
    return Promise.resolve(responseHelper.successWithData({ signer: accountAddress }));
  }

  /**
   * Validate Input parameters
   *
   * @return {*}
   * @private
   */
  _validateParameters() {
    const oThis = this;

    if (!oThis.signer || oThis.signer === undefined || !basicHelper.isAddressValid(oThis.signer)) {
      logger.error('Owner address is not passed or wrong in input parameters.');
      return responseHelper.error({
        internal_error_identifier: 'l_ar_ecr_3',
        api_error_identifier: 'unhandled_catch_response',
        debug_options: {}
      });
    }

    if (
      !oThis.messageToSign ||
      !oThis.personalSign ||
      oThis.messageToSign === undefined ||
      oThis.personalSign === undefined
    ) {
      logger.error('input parameter validation failed');
      return responseHelper.error({
        internal_error_identifier: 'l_ar_ecr_4',
        api_error_identifier: 'unhandled_catch_response',
        debug_options: {}
      });
    }
  }

  async _getProvidersFromConfig() {
    const oThis = this;

    let csHelper = new ConfigStrategyHelper(0),
      csResponse = await csHelper.getForKind(configStrategyConstants.originGeth),
      configForChain = csResponse.data[configStrategyConstants.originGeth],
      readWriteConfig = configForChain[configStrategyConstants.gethReadWrite],
      providers = readWriteConfig.wsProvider ? readWriteConfig.wsProviders : readWriteConfig.rpcProviders;

    return Promise.resolve(responseHelper.successWithData(providers));
  }
}

InstanceComposer.registerAsShadowableClass(Signer, coreConstants.icNameSpace, 'Signer');

module.exports = Signer;

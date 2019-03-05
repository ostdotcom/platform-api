'use strict';
/**
 * Base class for aux chain specific by chain owner funding crons.
 *
 * @module executables/funding/byMasterInternalFunder/auxChainSpecific/Base
 */

const rootPrefix = '../../../..',
  basicHelper = require(rootPrefix + '/helpers/basic'),
  TransferEth = require(rootPrefix + '/lib/transfer/Eth'),
  CronBase = require(rootPrefix + '/executables/CronBase'),
  GetEthBalance = require(rootPrefix + '/lib/getBalance/Eth'),
  TransferStPrimeBatch = require(rootPrefix + '/lib/fund/stPrime/BatchTransfer'),
  logger = require(rootPrefix + '/lib/logger/customConsoleLogger'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  GetStPrimeBalance = require(rootPrefix + '/lib/getBalance/StPrime'),
  chainConfigProvider = require(rootPrefix + '/lib/providers/chainConfig'),
  fundingAmounts = require(rootPrefix + '/config/funding'),
  chainAddressConstants = require(rootPrefix + '/lib/globalConstant/chainAddress'),
  tokenAddressConstants = require(rootPrefix + '/lib/globalConstant/tokenAddress'),
  ChainAddressCache = require(rootPrefix + '/lib/cacheManagement/kitSaas/ChainAddress');

/**
 * Base class for aux chain specific by chain owner funding crons.
 *
 * @class
 */
class FundByChainOwnerAuxChainSpecificBase extends CronBase {
  /**
   * Constructor
   *
   * @constructor
   */
  constructor(params) {
    super(params);
  }

  /**
   * Validate and sanitize
   *
   * @return {Promise<never>}
   *
   * @private
   */
  async _validateAndSanitize() {
    const oThis = this;

    if (!oThis.originChainId) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'e_f_bco_acs_b_1',
          api_error_identifier: 'something_went_wrong',
          debug_options: { originChainId: oThis.originChainId }
        })
      );
    }

    if (!oThis.auxChainId) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'e_f_bco_acs_b_2',
          api_error_identifier: 'something_went_wrong',
          debug_options: { auxChainId: oThis.auxChainId }
        })
      );
    }
  }

  /**
   * Start the cron.
   *
   * @return {Promise<void>}
   *
   * @private
   */
  async _start() {
    const oThis = this;

    logger.step('Fetching master internal funder address.');
    await oThis._fetchMasterInternalFunderAddress();

    logger.step('Sending StPrime funds in needed.');
    await oThis._sendFundsIfNeeded();

    logger.step('Cron completed.');
  }

  /**
   * Fetch master internal funder address
   *
   * @return {Promise<void>}
   *
   * @private
   */
  async _fetchMasterInternalFunderAddress() {
    const oThis = this;

    // Fetch all addresses associated with origin chain id.
    let chainAddressCacheObj = new ChainAddressCache({ associatedAuxChainId: 0 }),
      chainAddressesRsp = await chainAddressCacheObj.fetch();

    if (chainAddressesRsp.isFailure()) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'e_f_bco_acs_b_3',
          api_error_identifier: 'something_went_wrong'
        })
      );
    }

    oThis.masterInternalFunderAddress = chainAddressesRsp.data[chainAddressConstants.masterInternalFunderKind].address;
  }

  /**
   * Send funds specific implementation
   *
   * @return {Promise<void>}
   *
   * @private
   */
  async _sendFundsIfNeeded() {
    throw '_sendFundsIfNeeded method should be implemented by the caller';
  }

  /**
   * Fetch stPrime balance for given addreses for the given chainId.
   *
   * @param {Number} auxChainId
   * @param {Array} addresses
   *
   * @return {Promise<Object>} - Address to balance map
   *
   * @private
   */
  async _fetchStPrimeBalance(auxChainId, addresses) {
    const oThis = this;

    // Fetch StPrime balance for addresses.
    const getStPrimeBalance = new GetStPrimeBalance({
      auxChainId: auxChainId,
      addresses: addresses
    });

    return getStPrimeBalance.perform();
  }

  /**
   * Fetch ETH balances for all the addresses.
   *
   * @return {Promise<Object>} - Address to balance map
   *
   * @private
   */
  async _fetchEthBalances(addresses) {
    const oThis = this;

    // Fetch eth balances
    const getEthBalance = new GetEthBalance({
      originChainId: oThis.originChainId,
      addresses: addresses
    });

    return getEthBalance.perform();
  }

  /**
   * Transfer st prime on specific aux chain id on the following transfer details.
   *
   * @param {Number} auxChainId
   * @param {Object} transferDetails
   *
   * @return {Promise<void>}
   *
   * @private
   */
  async _transferStPrime(auxChainId, transferDetails) {
    const oThis = this;

    const transferStPrime = new TransferStPrimeBatch({
      auxChainId: auxChainId,
      transferDetails: transferDetails
    });

    await transferStPrime.perform();
  }

  /**
   * Transfer eth on specific origin chain id on the following transfer details.
   *
   * @param {Object} transferDetails
   *
   * @return {Promise<void>}
   *
   * @private
   */
  async _transferEth(transferDetails) {
    const oThis = this;

    const transferEth = new TransferEth({
      originChainId: oThis.originChainId,
      transferDetails: transferDetails
    });

    await transferEth.perform();
  }

  /**
   * This function calculates token funder's st prime requirement.
   *
   * @returns {Object}
   */
  calculateTokenAuxFunderStPrimeRequirement() {
    const oThis = this;

    let maxBalanceToFund = basicHelper.convertToWei(String(0)),
      thresholdBalance = basicHelper.convertToWei(String(0)),
      tokenAuxFunderConfig = basicHelper.deepDup(fundingAmounts[tokenAddressConstants.auxFunderAddressKind].auxGas);

    for (let address in tokenAuxFunderConfig) {
      maxBalanceToFund = maxBalanceToFund.plus(
        basicHelper.convertToWei(String(tokenAuxFunderConfig[address].fundAmount))
      );
      thresholdBalance = thresholdBalance.plus(
        basicHelper.convertToWei(String(tokenAuxFunderConfig[address].thresholdAmount))
      );
    }

    let calculation = {
      [tokenAddressConstants.auxFunderAddressKind]: {
        maxBalanceToFundAtOneGwei: maxBalanceToFund.toString(10),
        thresholdBalanceAtOneGwei: thresholdBalance.toString(10)
      }
    };

    return calculation;
  }

  /**
   * This function tells if the master internal funder eth balance is greater than the given amount.
   *
   * @param amount
   * @returns {Promise<boolean>}
   * @private
   */
  async _isMIFEthBalanceGreaterThan(amount) {
    const oThis = this;

    // Fetch eth balance
    let mifAddressToBalanceMap = await oThis._fetchEthBalances([oThis.masterInternalFunderAddress]),
      mifBalance = basicHelper.convertToBigNumber(mifAddressToBalanceMap[oThis.masterInternalFunderAddress]);

    if (mifBalance.lt(amount)) {
      //Create an alert
      logger.warn(
        'addressKind ' + oThis.masterInternalFunderAddress + ' has low balance on chainId: ' + oThis.originChainId
      );
      logger.notify(
        'e_f_bmif_acs_1',
        'Low balance of addressKind: ' + chainAddressConstants.masterInternalFunderKind + '. on chainId: ',
        +oThis.originChainId + ' Address: ' + oThis.masterInternalFunderAddress
      );

      return false;
    }

    return true;
  }

  /**
   * This function tells if the master internal funder st prime balance is greater than the given amount.
   *
   * @param amount
   * @returns {Promise<boolean>}
   * @private
   */
  async _isMIFStPrimeBalanceGreaterThan(amount) {
    const oThis = this;

    let mifAddressToBalanceMap = await oThis._fetchStPrimeBalance(oThis.auxChainId, [
        oThis.masterInternalFunderAddress
      ]),
      mifBalance = basicHelper.convertToBigNumber(mifAddressToBalanceMap[oThis.masterInternalFunderAddress]);

    if (mifBalance.lt(amount)) {
      //Create an alert
      logger.warn(
        'addressKind ' + oThis.masterInternalFunderAddress + ' has low st prime balance on chainId: ' + oThis.auxChainId
      );
      logger.notify(
        'e_f_bmif_acs_2',
        'Low st prime balance of addressKind: ' + chainAddressConstants.masterInternalFunderKind + '. on chainId: ',
        +oThis.auxChainId + ' Address: ' + oThis.masterInternalFunderAddress
      );

      return false;
    }

    return true;
  }
}

module.exports = FundByChainOwnerAuxChainSpecificBase;

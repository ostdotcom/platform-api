/**
 *
 * This module fund execute transaction workers with stPrime.
 *
 * @module lib/executeTransactionManagement/FundExTxWorker
 */

const rootPrefix = '../..',
  GetStPrimeBalance = require(rootPrefix + '/lib/getBalance/StPrime'),
  TokenAddressModel = require(rootPrefix + '/app/models/mysql/TokenAddress'),
  ErrorLogsConstants = require(rootPrefix + '/lib/globalConstant/errorLogs'),
  TransferStPrimeBatch = require(rootPrefix + '/lib/fund/stPrime/BatchTransfer'),
  TokenExTxWorkerProcessesModel = require(rootPrefix + '/app/models/mysql/TokenExtxWorkerProcesses'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  fundingAmounts = require(rootPrefix + '/config/funding'),
  coreConstants = require(rootPrefix + '/config/coreConstants'),
  logger = require(rootPrefix + '/lib/logger/customConsoleLogger'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  createErrorLogsEntry = require(rootPrefix + '/lib/errorLogs/createEntry'),
  workflowStepConstants = require(rootPrefix + '/lib/globalConstant/workflowStep'),
  tokenAddressConstants = require(rootPrefix + '/lib/globalConstant/tokenAddress');

// Declare variables.
const fundingAmountsAuxGasMap = fundingAmounts[tokenAddressConstants.auxFunderAddressKind].auxGas;

// Config for addresses which need to be funded.

// This value is calculated from the gas calculation sheet.
const fundingConfig = {
  [tokenAddressConstants.txWorkerAddressKind]: {
    oneGWeiMinOSTPrimeAmount: fundingAmountsAuxGasMap[tokenAddressConstants.txWorkerAddressKind].fundAmount,
    thresholdAmount: fundingAmountsAuxGasMap[tokenAddressConstants.txWorkerAddressKind].thresholdAmount
  }
};

/**
 * Class to execute transaction workers.
 *
 * @class FundExTxWorker
 */
class FundExTxWorker {
  /**
   * @constructor
   *
   * @param {Object} params
   * @param {Integer} params.tokenId
   * @param {Integer} params.chainId
   * @param {Array} [params.exTxWorkerAddresses] - optional parameter
   *
   */
  constructor(params) {
    const oThis = this;
    oThis.tokenId = params.tokenId;
    oThis.chainId = params.chainId;
    oThis.exTxWorkerAddresses = params.exTxWorkerAddresses;

    oThis.exTxTokenWorkerAddresses = {};
    oThis.auxTokenFunderAddress = {};
    oThis.exTxWorkingAddresses = [];
    oThis.addressToBalanceMap = {};
    oThis.transferDetails = [];
  }

  /**
   * Main Performer method.
   *
   * @returns {Promise<void>}
   */
  perform() {
    const oThis = this;

    return oThis.asyncPerform().catch(function(err) {
      logger.error(' In catch block of lib/executeTransactionManagement/FundExTxWorker');

      return responseHelper.error({
        internal_error_identifier: 'l_etm_fetw_1',
        api_error_identifier: 'something_went_wrong',
        debug_options: { err: err }
      });
    });
  }

  /**
   * Async performer method.
   *
   * @returns {Promise<void>}
   *
   * @private
   */
  async asyncPerform() {
    const oThis = this;

    await oThis._getExTxAddresses();

    // If working addresses are present,
    // There is no need to fetch exTxWorkingAddresses

    if (oThis.exTxWorkerAddresses) {
      oThis.exTxWorkingAddresses = oThis.exTxWorkerAddresses;
    } else {
      await oThis._getWorkingAddresses();
    }

    if (oThis.exTxWorkingAddresses.length) {
      await oThis._getWorkingAddressesBalance();

      await oThis._checkIfBalanceRequired();

      const transferResponse = await oThis._transferBalance();

      return responseHelper.successWithData({
        taskStatus: workflowStepConstants.taskDone,
        debugParams: { transactionHashes: transferResponse.data }
      });
    }

    return responseHelper.successWithData({
      taskStatus: workflowStepConstants.taskDone
    });
  }

  /**
   * This method fetch txWorker Addresses and its respective aux funder from token addresses.
   *
   * @returns {Promise<void>}
   */
  async _getExTxAddresses() {
    const oThis = this;

    const dbRows = await new TokenAddressModel()
      .select('*')
      .where([
        'token_id = ? AND status = ?',
        oThis.tokenId,
        new TokenAddressModel().invertedStatuses[tokenAddressConstants.activeStatus]
      ])
      .where([
        'kind IN (?)',
        [
          new TokenAddressModel().invertedKinds[tokenAddressConstants.txWorkerAddressKind],
          new TokenAddressModel().invertedKinds[tokenAddressConstants.auxFunderAddressKind]
        ]
      ])
      .fire();

    for (let index = 0; index < dbRows.length; index++) {
      const dbRow = dbRows[index],
        addressKindStr = new TokenAddressModel().kinds[dbRow.kind.toString()];

      // Fetch worker id to its address map.
      if (addressKindStr === tokenAddressConstants.txWorkerAddressKind) {
        oThis.exTxTokenWorkerAddresses[dbRow.id] = dbRow.address;
      } else {
        // Fetch aux funder address.
        oThis.auxTokenFunderAddress = dbRow.address;
      }
    }

    logger.debug('oThis.exTxTokenWorkerAddresses', oThis.exTxTokenWorkerAddresses);
    logger.debug('oThis.auxTokenFunderAddress', oThis.auxTokenFunderAddress);
  }

  /**
   * Get execute transaction working addresses.
   *
   * @returns {Promise<void>}
   *
   * @private
   */
  async _getWorkingAddresses() {
    const oThis = this;

    const dbRows = await new TokenExTxWorkerProcessesModel()
      .select('*')
      .where(['token_id = ? AND tx_cron_process_detail_id IS NOT NULL', oThis.tokenId])
      .fire();

    for (let index = 0; index < dbRows.length; index++) {
      const dbRow = dbRows[index];

      // Check if the workers are active, if yes push into an array, else do nothing.
      if (oThis.exTxTokenWorkerAddresses[dbRow.token_address_id]) {
        oThis.exTxWorkingAddresses.push(oThis.exTxTokenWorkerAddresses[dbRow.token_address_id]);
      }
    }
  }

  /**
   * Get working addresses st Prime balance.
   *
   * @returns {Promise<void>}
   *
   * @private
   */
  async _getWorkingAddressesBalance() {
    const oThis = this;

    logger.debug('======== oThis.exTxWorkingAddresses =======', oThis.exTxWorkingAddresses);

    if (oThis.exTxWorkingAddresses.length > 0) {
      // Fetch StPrime balance for addresses.
      const getStPrimeBalanceObj = new GetStPrimeBalance({
        auxChainId: oThis.chainId,
        addresses: oThis.exTxWorkingAddresses
      });

      oThis.addressToBalanceMap = await getStPrimeBalanceObj.perform();

      logger.debug('====== oThis.addressToBalanceMap ======', oThis.addressToBalanceMap);
    }
  }

  /**
   * Check if working addresses need balance.
   *
   * @returns {Promise<void>}
   *
   * @private
   */
  async _checkIfBalanceRequired() {
    const oThis = this;

    const auxMaxGasPriceMultiplierWithBuffer = basicHelper.getAuxMaxGasPriceMultiplierWithBuffer();

    oThis.totalAmountToTransfer = basicHelper.convertToBigNumber(0);

    // Determine minimum balances of addresses.
    const tokenTxWorkerMaxAmountToFund = basicHelper
        .convertToLowerUnit(
          String(fundingConfig[tokenAddressConstants.txWorkerAddressKind].oneGWeiMinOSTPrimeAmount),
          coreConstants.OSTPRIME_DECIMALS
        )
        .mul(basicHelper.convertToBigNumber(auxMaxGasPriceMultiplierWithBuffer)),
      tokenTxWorkerThresholdBalance = basicHelper
        .convertToLowerUnit(
          String(fundingConfig[tokenAddressConstants.txWorkerAddressKind].thresholdAmount),
          coreConstants.OSTPRIME_DECIMALS
        )
        .mul(basicHelper.convertToBigNumber(auxMaxGasPriceMultiplierWithBuffer));

    for (const address in oThis.addressToBalanceMap) {
      // Determine current balances of addresses.
      const tokenTxWorkerCurrentBalance = basicHelper.convertToBigNumber(oThis.addressToBalanceMap[address]);

      // Check for refund eligibility.
      if (tokenTxWorkerCurrentBalance.lt(tokenTxWorkerThresholdBalance)) {
        const amountToTransferBN = tokenTxWorkerMaxAmountToFund.minus(tokenTxWorkerCurrentBalance),
          params = {
            fromAddress: oThis.auxTokenFunderAddress,
            toAddress: address,
            amountInWei: amountToTransferBN.toString(10)
          };
        oThis.totalAmountToTransfer = oThis.totalAmountToTransfer.plus(amountToTransferBN);
        oThis.transferDetails.push(params);
      }
    }
  }

  /**
   * Transfer St Prime balance to active workers.
   *
   * @returns {Promise<void>}
   *
   * @private
   */
  async _transferBalance() {
    const oThis = this;

    if (
      oThis.transferDetails.length > 0 &&
      (await oThis._isTokenAuxFunderBalanceGreaterThan(oThis.totalAmountToTransfer))
    ) {
      const transferStPrime = new TransferStPrimeBatch({
        auxChainId: oThis.chainId,
        transferDetails: oThis.transferDetails,
        handleSigint: 1
      });
      const response = await transferStPrime.perform();

      const exTxWorkerAddressToTxHash = response.data;

      // Check if all workers have received stprime fund
      for (let index = 0; index < oThis.transferDetails.length; index++) {
        const trDetails = oThis.transferDetails[index];
        if (!exTxWorkerAddressToTxHash[trDetails.toAddress]) {
          return Promise.reject(
            responseHelper.error({
              internal_error_identifier: 'l_etm_fetw_2',
              api_error_identifier: 'unhandled_catch_response',
              debug_options: {
                err: 'Fund(STPrime) was not transfered to worker address - ' + trDetails.toAddress,
                transferResponse: response
              }
            })
          );
        }
      }

      return response;
    }

    return responseHelper.successWithData({});
  }

  /**
   * This function tells if token aux funder address st prime balance is greater than the given amount.
   *
   * @param amount
   * @returns {Promise<boolean>}
   * @private
   */
  async _isTokenAuxFunderBalanceGreaterThan(amount) {
    const oThis = this;

    const getStPrimeBalanceObj = new GetStPrimeBalance({
      auxChainId: oThis.chainId,
      addresses: [oThis.auxTokenFunderAddress]
    });

    const tokenAuxFunderAddressToBalanceMap = await getStPrimeBalanceObj.perform(),
      tokenAuxFunderAddressBalance = basicHelper.convertToBigNumber(
        tokenAuxFunderAddressToBalanceMap[oThis.auxTokenFunderAddress]
      );

    if (tokenAuxFunderAddressBalance.lt(amount)) {
      // Create an alert
      logger.warn(
        'Token aux funder address: ' +
          oThis.auxTokenFunderAddress +
          ' has low balance on chainId: ' +
          oThis.chainId +
          ' token id: ' +
          oThis.tokenId
      );

      const errorObject = responseHelper.error({
        internal_error_identifier: 'low_balance:l_etm_fetw_3',
        api_error_identifier: 'low_balance',
        debug_options: {
          addressKind: tokenAddressConstants.auxFunderAddressKind,
          chainId: oThis.chainId,
          address: oThis.auxTokenFunderAddress,
          tokenId: oThis.tokenId,
          amount: amount
        }
      });

      await createErrorLogsEntry.perform(errorObject, ErrorLogsConstants.highSeverity);

      return false;
    }

    return true;
  }
}

module.exports = FundExTxWorker;

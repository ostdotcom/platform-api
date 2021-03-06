/**
 * Module to set price in price oracle contract.
 *
 * @module lib/updatePricePoints/SetPriceInPriceOracleContract
 */

const OSTBase = require('@ostdotcom/base'),
  InstanceComposer = OSTBase.InstanceComposer,
  OpenSTOracle = require('@ostdotcom/ost-price-oracle'),
  PriceOracleHelper = OpenSTOracle.PriceOracleHelper;

const rootPrefix = '../..',
  ConfigStrategyObject = require(rootPrefix + '/helpers/configStrategy/Object'),
  SubmitTransaction = require(rootPrefix + '/lib/transactions/SignSubmitTrxOnChain'),
  ChainAddressCache = require(rootPrefix + '/lib/cacheManagement/kitSaas/ChainAddress'),
  CurrencyConversionRateModel = require(rootPrefix + '/app/models/mysql/CurrencyConversionRate'),
  StakeCurrencyBySymbolCache = require(rootPrefix + '/lib/cacheManagement/kitSaasMulti/StakeCurrencyBySymbol'),
  QuoteCurrencyBySymbolCache = require(rootPrefix + '/lib/cacheManagement/kitSaasMulti/QuoteCurrencyBySymbol'),
  AuxPriceOracleModel = require(rootPrefix + '/app/models/mysql/AuxPriceOracle'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  web3Provider = require(rootPrefix + '/lib/providers/web3'),
  coreConstants = require(rootPrefix + '/config/coreConstants'),
  logger = require(rootPrefix + '/lib/logger/customConsoleLogger'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  contractConstants = require(rootPrefix + '/lib/globalConstant/contract'),
  workflowStepConstants = require(rootPrefix + '/lib/globalConstant/workflowStep'),
  chainAddressConstants = require(rootPrefix + '/lib/globalConstant/chainAddress'),
  conversionRateConstants = require(rootPrefix + '/lib/globalConstant/conversionRates'),
  createErrorLogsEntry = require(rootPrefix + '/lib/errorLogs/createEntry'),
  errorLogsConstants = require(rootPrefix + '/lib/globalConstant/errorLogs'),
  pendingTransactionConstants = require(rootPrefix + '/lib/globalConstant/pendingTransaction');

/**
 * Class to set price in price oracle contract.
 *
 * @class SetPriceInPriceOracleContract
 */
class SetPriceInPriceOracleContract {
  /**
   * Constructor to set price in price oracle contract.
   *
   * @param {object} params
   * @param {string} params.auxChainId: auxChainId
   * @param {string} params.baseCurrency: baseCurrency
   * @param {object} params.currentErc20Value: currentErc20Value
   * @param {boolean} params.setOldValuesInContract: setOldValuesInContract
   * @param {object} params.pendingTransactionExtraData: pendingTransactionExtraData
   * @param {object} params.waitTillReceipt: wait till receipt
   *
   * @constructor
   */
  constructor(params) {
    const oThis = this;

    oThis.auxChainId = params.auxChainId;
    oThis.currentErc20Value = params.currentErc20Value;
    oThis.baseCurrency = params.baseCurrency;
    oThis.pendingTransactionExtraData = params.pendingTransactionExtraData;
    oThis.waitTillReceipt = params.waitTillReceipt || 0;
    oThis.setOldValuesInContract = params.setOldValuesInContract;

    oThis.auxGasPrice = null;
    oThis.chainEndpoint = null;
    oThis.auxWeb3Instance = null;
    oThis.updatePricePointsGas = null;
    oThis.auxPriceOracleContractAddress = null;
    oThis.auxPriceOracleContractWorkerAddress = null;
  }

  /**
   * Main performer of the class.
   *
   * @return {Promise<void>}
   */
  async perform() {
    const oThis = this;

    await oThis._initializeVars();

    await oThis._fetchPriceOracleContractAddress();

    // If set old price is true, means not able to fetch data from coin market cap api
    if (oThis.setOldValuesInContract) {
      await oThis._fetchOldPricePointFromDb();
    }

    await oThis._setWeb3Instance();

    const submitTxRsp = await oThis._setPriceInPriceOracle();

    await oThis._insertPricePointInTable(submitTxRsp.data.transactionHash);

    return Promise.resolve(
      responseHelper.successWithData({
        taskStatus: workflowStepConstants.taskPending,
        transactionHash: submitTxRsp.data.transactionHash,
        taskResponseData: {
          // This data is required for next dependent steps.
          transactionHash: submitTxRsp.data.transactionHash,
          currencyConversionTableId: oThis.currencyConversionTableId,
          currentErc20Value: oThis.currentErc20Value,
          priceOracleContractAddress: oThis.auxPriceOracleContractAddress
        },
        debugParams: {
          priceOracleContractAddress: oThis.auxPriceOracleContractAddress,
          priceOracleWorkerAddress: oThis.auxPriceOracleContractWorkerAddress
        }
      })
    );
  }

  /**
   * Initialize required variables.
   *
   * @sets oThis.chainEndpoint, oThis.auxGasPrice, oThis.updatePricePointsGas
   *
   * @return {Promise<void>}
   * @private
   */
  async _initializeVars() {
    const oThis = this;

    oThis.chainEndpoint = oThis._configStrategyObject.chainRpcProvider(oThis.auxChainId, 'readWrite');
    oThis.auxGasPrice = contractConstants.auxChainGasPrice;
    oThis.updatePricePointsGas = contractConstants.updatePricePointsGas;
    oThis.currentTime = Math.floor(new Date().getTime() / 1000);
  }

  /**
   * Fetch old price points from db
   *
   * @returns {Promise<void>}
   * @private
   */
  async _fetchOldPricePointFromDb() {
    const oThis = this;

    // If set old price is true, means not able to fetch data from coin market cap api
    // In that case, fetch last value and re-insert it.
    // This should be done only if last inserted data point is less than 12 hours
    // If more than 12 hours have been passed, raise an exception

    const lastInsertedDataResp = await new CurrencyConversionRateModel()
      .select('*')
      .where([
        'chain_id = ? AND stake_currency_id = ? AND quote_currency_id = ?',
        oThis.auxChainId,
        oThis.stakeCurrencyId,
        oThis.quoteCurrencyId
      ])
      .order_by('created_at DESC')
      .limit(1)
      .fire();

    // Last entry not found or 12 hours have been passed in last successful transaction
    if (
      !lastInsertedDataResp[0] ||
      basicHelper.dateToSecondsTimestamp(lastInsertedDataResp[0].created_at) < oThis.currentTime - 12 * 3600
    ) {
      const errorObject = responseHelper.error({
        internal_error_identifier: 'coinMarketCapApi_call_failing',
        api_error_identifier: 'coinMarketCapApi_call_failing',
        debug_options: { erc20Value: oThis.currentErc20Value }
      });

      await createErrorLogsEntry.perform(errorObject, errorLogsConstants.highSeverity);

      return Promise.reject(errorObject);
    }

    oThis.currentErc20Value.conversionRate = lastInsertedDataResp[0].conversion_rate;
    oThis.currentErc20Value.createdAt = lastInsertedDataResp[0].created_at;
  }

  /**
   * Fetch price oracle contract address
   *
   * @sets oThis.auxPriceOracleContractWorkerAddress, oThis.auxPriceOracleContractAddress, oThis.stakeCurrencyId, oThis.quoteCurrencyId
   *
   * @return {Promise<void>}
   * @private
   */
  async _fetchPriceOracleContractAddress() {
    const oThis = this;

    // Fetch price oracle worker address
    const chainAddressCacheObj = new ChainAddressCache({ associatedAuxChainId: oThis.auxChainId }),
      chainAddressesRsp = await chainAddressCacheObj.fetch();

    if (chainAddressesRsp.isFailure()) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_upp_spipo_1',
          api_error_identifier: 'something_went_wrong'
        })
      );
    }

    oThis.auxPriceOracleContractWorkerAddress =
      chainAddressesRsp.data[chainAddressConstants.auxPriceOracleContractWorkerKind][0].address;

    // Fetch stake currency id
    let stakeCurrencyBySymbolCache = new StakeCurrencyBySymbolCache({
      stakeCurrencySymbols: [oThis.currentErc20Value.baseCurrency]
    });

    let response = await stakeCurrencyBySymbolCache.fetch();

    oThis.stakeCurrencyId = response.data[oThis.currentErc20Value.baseCurrency].id;

    // Fetch quote currency id
    let quoteCurrencyBySymbolCache = new QuoteCurrencyBySymbolCache({
      quoteCurrencySymbols: [oThis.currentErc20Value.quoteCurrency]
    });

    let quoteCurrencyCacheRsp = await quoteCurrencyBySymbolCache.fetch();

    let quoteCurrencyData = quoteCurrencyCacheRsp.data;

    oThis.quoteCurrencyId = quoteCurrencyData[oThis.currentErc20Value.quoteCurrency].id;

    // Fetch price oracle contract address
    let auxPriceOracleModel = new AuxPriceOracleModel({});

    let priceOracleRsp = await auxPriceOracleModel.fetchPriceOracleDetails({
      chainId: oThis.auxChainId,
      stakeCurrencyId: oThis.stakeCurrencyId,
      quoteCurrencyId: oThis.quoteCurrencyId
    });

    oThis.auxPriceOracleContractAddress = priceOracleRsp.data['contractAddress'];
  }

  /**
   * Set Web3 Instance.
   *
   * @sets oThis.auxWeb3Instance
   *
   * @return {Promise<void>}
   * @private
   */
  async _setWeb3Instance() {
    const oThis = this;

    oThis.auxWeb3Instance = web3Provider.getInstance(oThis.chainEndpoint).web3WsProvider;
  }

  /**
   * Deploy contract.
   *
   * @returns {Promise<*>}
   * @private
   */
  async _setPriceInPriceOracle() {
    const oThis = this;

    // Don't change this conversion to respective decimals, since it is hardcoded in contract.
    const priceResponse = basicHelper.convertToLowerUnit(
        oThis.currentErc20Value.conversionRate,
        coreConstants.USD_DECIMALS
      ),
      amountInWei = priceResponse.toString(10);

    // Get transaction object.
    const txResponse = new PriceOracleHelper(oThis.auxWeb3Instance).setPriceTx(
      oThis.auxWeb3Instance,
      oThis.currentErc20Value.baseCurrency,
      oThis.currentErc20Value.quoteCurrency,
      oThis.auxPriceOracleContractAddress,
      amountInWei,
      oThis.auxGasPrice
    );

    // Prepare params for transaction.
    const encodedABI = txResponse.encodedABI,
      txOptions = {
        from: oThis.auxPriceOracleContractWorkerAddress,
        to: oThis.auxPriceOracleContractAddress,
        value: contractConstants.zeroValue,
        data: encodedABI,
        gas: oThis.updatePricePointsGas,
        gasPrice: oThis.auxGasPrice
      };

    if (oThis.waitTillReceipt) {
      txOptions['waitTillReceipt'] = oThis.waitTillReceipt;
    }

    const submitTxRsp = await new SubmitTransaction({
      chainId: oThis.auxChainId,
      tokenId: oThis.tokenId,
      pendingTransactionKind: pendingTransactionConstants.updatePricePointsKind,
      provider: oThis.chainEndpoint,
      txOptions: txOptions,
      options: oThis.pendingTransactionExtraData
    }).perform();

    if (submitTxRsp && submitTxRsp.isFailure()) {
      return Promise.reject(submitTxRsp);
    }

    return Promise.resolve(submitTxRsp);
  }

  /**
   * Insert price points into Currency Conversion Rates Table.
   *
   * @param {string} transactionHash
   *
   * @sets oThis.currencyConversionTableId
   *
   * @returns {Promise<Promise<never> | Promise<any>>}
   * @private
   */
  async _insertPricePointInTable(transactionHash) {
    const oThis = this;

    // Insert current erc20 value in database
    const insertResponse = await new CurrencyConversionRateModel()
      .insert({
        chain_id: oThis.auxChainId,
        stake_currency_id: oThis.stakeCurrencyId,
        quote_currency_id: oThis.quoteCurrencyId,
        conversion_rate: oThis.currentErc20Value.conversionRate,
        timestamp: oThis.currentErc20Value.timestamp,
        transaction_hash: transactionHash,
        status: conversionRateConstants.invertedStatuses[oThis.currentErc20Value.status],
        created_at: oThis.currentErc20Value.createdAt || new Date()
      })
      .fire();

    if (!insertResponse) {
      logger.error('Error while inserting data in table');

      return Promise.reject(new Error('Error while inserting data in table'));
    }

    oThis.currencyConversionTableId = insertResponse.insertId;
  }

  /**
   * Config strategy
   *
   * @return {object}
   */
  get _configStrategy() {
    const oThis = this;

    return oThis.ic().configStrategy;
  }

  /**
   * Object of config strategy class.
   *
   * @sets oThis.configStrategyObj
   *
   * @return {object}
   */
  get _configStrategyObject() {
    const oThis = this;

    if (oThis.configStrategyObj) {
      return oThis.configStrategyObj;
    }

    oThis.configStrategyObj = new ConfigStrategyObject(oThis._configStrategy);

    return oThis.configStrategyObj;
  }
}

InstanceComposer.registerAsShadowableClass(
  SetPriceInPriceOracleContract,
  coreConstants.icNameSpace,
  'SetPriceInPriceOracleContract'
);

module.exports = {};

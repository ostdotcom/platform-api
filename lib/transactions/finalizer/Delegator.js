'use strict';

/*
 * Class for publishing transactions for which balance settling should happen
 *
 * @module lib/transactions/finalizer/Delegator
 */

const rootPrefix = '../../..',
  rabbitmqProvider = require(rootPrefix + '/lib/providers/rabbitmq'),
  rabbitmqConstant = require(rootPrefix + '/lib/globalConstant/rabbitmq'),
  logger = require(rootPrefix + '/lib/logger/customConsoleLogger'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  connectionTimeoutConst = require(rootPrefix + '/lib/globalConstant/connectionTimeout'),
  TxFinalizeTaskModel = require(rootPrefix + '/app/models/mysql/TransactionFinalizerTask');

const TX_FINALIZE_BATCH_SIZE = 25;

class TxFinalizeDelegator {
  /**
   * @constructor
   *
   * @param params
   * @param params.auxChainId         {Number} - auxiliary chain id
   * @param params.blockNumber        {Number} - block number
   * @param params.transactionHashes  {Array}  - Array of transaction hashes
   */
  constructor(params) {
    const oThis = this;

    oThis.auxChainId = params.auxChainId;
    oThis.blockNumber = params.blockNumber;
    oThis.transactionHashes = params.transactionHashes;

    oThis.rmqConnection = null;
  }

  /**
   * Perform transaction finalize delegation
   *
   * @return {Promise<void>}
   */
  async perform() {
    const oThis = this;

    await oThis._createRmqConnection();

    while (true) {
      oThis.transactionChunk = oThis._getNextTransactionSlice();

      if (oThis.transactionChunk.length === 0) {
        break;
      }

      await oThis._createTxFinalizeTask();

      let response = await oThis._publishToRmq();

      if (response.isFailure()) {
        return response;

        let txFinalizeTaskModel = new TxFinalizeTaskModel();

        await txFinalizeTaskModel.markTaskFailed(oThis.taskId, { response: response });
      }
    }
    return responseHelper.successWithData({});
  }

  /**
   *
   * @private
   */
  async _createRmqConnection() {
    const oThis = this;

    oThis.rmqConnection = await rabbitmqProvider.getInstance(rabbitmqConstant.auxRabbitmqKind, {
      auxChainId: oThis.auxChainId,
      connectionWaitSeconds: connectionTimeoutConst.crons,
      switchConnectionWaitSeconds: connectionTimeoutConst.switchConnectionCrons
    });
  }

  /**
   * Returns the next batch of transactions to process
   * @return {Array}
   * @private
   */
  _getNextTransactionSlice() {
    const oThis = this;
    return oThis.transactionHashes.splice(0, TX_FINALIZE_BATCH_SIZE);
  }

  /**
   * This creates an entry in transaction finalize task
   *
   * @return {Promise<void>}
   * @private
   */
  async _createTxFinalizeTask() {
    const oThis = this,
      txFinalizeTaskModel = new TxFinalizeTaskModel();

    let response = await txFinalizeTaskModel.insertTask(oThis.auxChainId, oThis.blockNumber, oThis.transactionChunk);

    oThis.taskId = response.insertId;
  }

  /**
   * Publish task to RMQ
   *
   * @return {Promise<void>}
   * @private
   */
  async _publishToRmq() {
    const oThis = this;

    let messageParams = {
      topics: oThis._topicsToPublish,
      publisher: oThis._publisher,
      message: {
        kind: oThis._messageKind,
        payload: {
          taskId: oThis.taskId
        }
      }
    };

    let setToRMQ = await oThis.rmqConnection.publishEvent.perform(messageParams);

    if (setToRMQ.isFailure() || setToRMQ.data.publishedToRmq === 0) {
      logger.error("====Couldn't publish the message to RMQ====");
      return setToRMQ;
    }

    logger.debug('===Published task', oThis.taskId, 'for blockNumber', oThis.blockNumber);

    return setToRMQ;
  }

  /**
   * Topic to publish to
   *
   * @return {*[]}
   * @private
   */
  get _topicsToPublish() {
    const oThis = this;
    return ['transaction_finalizer_' + oThis.auxChainId.toString()];
  }

  /**
   * Publisher of the message
   *
   * @return {string}
   * @private
   */
  get _publisher() {
    return 'OST';
  }

  get _messageKind() {
    return 'background_job';
  }
}

module.exports = TxFinalizeDelegator;

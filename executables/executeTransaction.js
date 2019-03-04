'use strict';
/**
 * execute transaction
 *
 * @module executables/executeTransaction
 */
const program = require('commander'),
  OSTBase = require('@ostdotcom/base');

const rootPrefix = '..',
  kwcConstant = require(rootPrefix + '/lib/globalConstant/kwc'),
  logger = require(rootPrefix + '/lib/logger/customConsoleLogger'),
  cronProcessesConstants = require(rootPrefix + '/lib/globalConstant/cronProcesses'),
  MultiSubscriptionBase = require(rootPrefix + '/executables/rabbitmq/MultiSubscriptionBase'),
  InitExTxExecutableProcess = require(rootPrefix + '/lib/executeTransactionManagement/InitProcess'),
  SequentialManager = require(rootPrefix + '/lib/transactions/SequentialManager'),
  CommandMessageProcessor = require(rootPrefix + '/lib/executeTransactionManagement/CommandMessageProcessor'),
  StrategyByChainHelper = require(rootPrefix + '/helpers/configStrategy/ByChainId'),
  coreConstants = require(rootPrefix + '/config/coreConstants'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  rabbitmqConstants = require(rootPrefix + '/lib/globalConstant/rabbitmq'),
  RabbitmqSubscription = require(rootPrefix + '/lib/entity/RabbitSubscription');

const InstanceComposer = OSTBase.InstanceComposer;

require(rootPrefix + '/lib/transactions/ProcessRmqMessage');

program.option('--cronProcessId <cronProcessId>', 'Cron table process ID').parse(process.argv);

program.on('--help', function() {
  logger.log('');
  logger.log('  Example:');
  logger.log('');
  logger.log('    node executables/executeTransaction.js --cronProcessId 18');
  logger.log('');
  logger.log('');
});

let cronProcessId = +program.cronProcessId;
if (!cronProcessId) {
  program.help();
  process.exit(1);
}

/**
 * Class for Execute Transaction Process.
 *
 * @class
 */
class ExecuteTransactionExecutable extends MultiSubscriptionBase {
  /**
   * Constructor for Execute Transaction Process.
   *
   * @augments SubscriberBase
   *
   * @param {Object} params: params object
   * @param {Number} params.cronProcessId: cron_processes table id
   *
   * @constructor
   */
  constructor(params) {
    super(params);

    const oThis = this;

    oThis.initProcessResp = {};
    oThis.exTxTopicName = null;
    oThis.cMsgTopicName = null;
    oThis.auxChainId = null;
    oThis.ic = null;
  }

  /**
   * Before subscribe
   *
   * @return {Promise<void>}
   * @private
   */
  async _beforeSubscribe() {
    const oThis = this;

    // Query to get queue_topic suffix, chainId and whether to start consumption
    oThis.initProcessResp = await new InitExTxExecutableProcess({ processId: cronProcessId }).perform();

    // Fetch config strategy for the aux chain
    const strategyByChainHelperObj = new StrategyByChainHelper(oThis.auxChainId),
      configStrategyResp = await strategyByChainHelperObj.getComplete();

    // if config strategy fetch failed, then emit SIGINT
    if (configStrategyResp.isFailure()) {
      logger.error('Could not fetch configStrategy. Exiting the process.');
      process.emit('SIGINT');
    }

    const configStrategy = configStrategyResp.data;

    // Creating ic object using the config strategy
    oThis.ic = new InstanceComposer(configStrategy);
  }

  /**
   * Prepare subscription data.
   *
   * @returns {{}}
   * @private
   */
  _prepareSubscriptionData() {
    const oThis = this,
      queueTopicSuffix = oThis.initProcessResp.processDetails.queueTopicSuffix;

    oThis.auxChainId = oThis.initProcessResp.processDetails.chainId;

    // Set topic names in oThis. Topic names are used while starting the subscription.
    oThis.exTxTopicName = kwcConstant.exTxTopicName(oThis.auxChainId, queueTopicSuffix);
    oThis.cMsgTopicName = kwcConstant.commandMessageTopicName(oThis.auxChainId, queueTopicSuffix);

    // Fetch queue names.
    let exTxQueueName = kwcConstant.exTxQueueName(oThis.auxChainId, queueTopicSuffix),
      cMsgQueueName = kwcConstant.commandMessageQueueName(oThis.auxChainId, queueTopicSuffix);

    // Set rabbitmq subscription object.
    oThis.subscriptionTopicToDataMap[oThis.exTxTopicName] = new RabbitmqSubscription({
      rabbitmqKind: rabbitmqConstants.auxRabbitmqKind,
      topic: oThis.exTxTopicName,
      queue: exTxQueueName,
      prefetchCount: oThis.prefetchCount,
      auxChainId: oThis.auxChainId
    });

    oThis.subscriptionTopicToDataMap[oThis.cMsgTopicName] = new RabbitmqSubscription({
      rabbitmqKind: rabbitmqConstants.auxRabbitmqKind,
      topic: oThis.cMsgTopicName,
      queue: cMsgQueueName,
      prefetchCount: 1,
      auxChainId: oThis.auxChainId
    });
  }

  /**
   * Start subscription
   *
   * @return {Promise<void>}
   * @private
   */
  async _startSubscription() {
    const oThis = this;

    // check if subscription can start for ex tx queue, if yes start subscription.
    if (oThis.initProcessResp.shouldStartTxQueConsume === 1) {
      await oThis._startSubscriptionFor(oThis.exTxTopicName);
    }

    // always start subscription for command message queue.
    await oThis._startSubscriptionFor(oThis.cMsgTopicName);
  }

  /**
   * Sequential executor
   *
   * @param messageParams
   * @return {Promise<any>}
   * @private
   */
  async _sequentialExecutor(messageParams) {
    const oThis = this;
    let msgParams = messageParams.message.payload,
      kind = messageParams.message.kind;

    // Sequential executor required only in case of execute transaction message kind. Otherwise do nothing.
    if (kind === kwcConstant.executeTx) {
      return new SequentialManager(oThis.auxChainId, msgParams.tokenAddressId).perform(msgParams.transactionMetaId);
    } else {
      return responseHelper.successWithData({});
    }
  }

  /**
   * Process name prefix
   *
   * @returns {String}
   *
   * @private
   */
  get _processNamePrefix() {
    return 'execute_transaction_processor';
  }

  /**
   * Specific validations
   *
   * @returns {Boolean}
   *
   * @private
   */
  _specificValidations() {
    // Add specific validations here
    return true;
  }

  /**
   * Cron kind
   *
   * @returns {String}
   *
   * @private
   */
  get _cronKind() {
    return cronProcessesConstants.executeTransaction;
  }

  /**
   * Increment Unack count.
   *
   * @param messageParams
   * @returns {boolean}
   * @private
   */
  _incrementUnAck(messageParams) {
    const oThis = this;

    let msgParams = messageParams.message.payload,
      kind = msgParams.kind;

    if (kind == kwcConstant.executeTx) {
      oThis.subscriptionTopicToDataMap[oThis.exTxTopicName].incrementUnAckCount();
    } else if (kind == kwcConstant.commandMsg) {
      oThis.subscriptionTopicToDataMap[oThis.cMsgTopicName].incrementUnAckCount();
    }
    return true;
  }

  /**
   * Decrement Unack count.
   *
   * @param messageParams
   * @returns {boolean}
   * @private
   */
  _decrementUnAck(messageParams) {
    const oThis = this;

    let msgParams = messageParams.message.payload,
      kind = msgParams.kind;

    if (kind == kwcConstant.executeTx) {
      oThis.subscriptionTopicToDataMap[oThis.exTxTopicName].decrementUnAckCount();
    } else if (kind == kwcConstant.commandMsg) {
      oThis.subscriptionTopicToDataMap[oThis.cMsgTopicName].decrementUnAckCount();
    }
    return true;
  }

  /**
   * Get Unack count.
   *
   * @param messageParams
   * @returns {number}
   * @private
   */
  _getUnAck(messageParams) {
    const oThis = this;

    let msgParams = messageParams.message.payload,
      kind = msgParams.kind;

    if (kind == kwcConstant.executeTx) {
      return oThis.subscriptionTopicToDataMap[oThis.exTxTopicName].unAckCount;
    } else if (kind == kwcConstant.commandMsg) {
      return oThis.subscriptionTopicToDataMap[oThis.cMsgTopicName].unAckCount;
    }
    return 0;
  }

  /**
   * Process message
   *
   * @param {Object} messageParams
   * @param {String} messageParams.kind: whether it is command message or ex tx message.
   * @param {Object} messageParams.message
   * @param {Object} messageParams.message.payload
   *
   * @returns {Promise<>}
   *
   * @private
   */
  async _processMessage(messageParams) {
    const oThis = this;

    // Identify which file/function to initiate to execute task of specific kind.

    let msgParams = messageParams.message.payload,
      kind = messageParams.message.kind;

    // TODO - move to debug logs.
    logger.log('_processMessage-------------------------.......\n', messageParams);

    if (kind == kwcConstant.executeTx) {
      logger.info('Message specific perform called called called called called called called.......\n');
      //message specific perform called.

      const payload = messageParams.message.payload;

      let ProcessRmqExecuteTxMessage = oThis.ic.getShadowedClassFor(
          coreConstants.icNameSpace,
          'ProcessRmqExecuteTxMessage'
        ),
        processRmqExecuteTxMessage = new ProcessRmqExecuteTxMessage({
          transactionUuid: payload.transaction_uuid,
          transactionMetaId: payload.transactionMetaId,
          fromAddress: messageParams.fromAddress,
          fromAddressNonce: messageParams.fromAddressNonce
        });

      // Process Ex Tx Message
      await processRmqExecuteTxMessage.perform();
    } else if (kind == kwcConstant.commandMsg) {
      logger.info('Command specific perform called called called called called called called called.......\n');
      let commandMessageParams = {
        auxChainId: oThis.auxChainId,
        commandMessage: msgParams
      };
      let commandProcessorResponse = await new CommandMessageProcessor(commandMessageParams).perform();
      await oThis._commandResponseActions(commandProcessorResponse);
    }

    return true;
  }

  /**
   * Actions to take on command messages.
   *
   * @param commandProcessorResponse
   * @returns {Promise<boolean>}
   * @private
   */
  async _commandResponseActions(commandProcessorResponse) {
    const oThis = this;

    if (
      commandProcessorResponse &&
      commandProcessorResponse.data.shouldStartTxQueConsume &&
      commandProcessorResponse.data.shouldStartTxQueConsume === 1
    ) {
      await oThis._startSubscriptionFor(oThis.exTxTopicName);
    } else if (
      commandProcessorResponse &&
      commandProcessorResponse.data.shouldStopTxQueConsume &&
      commandProcessorResponse.data.shouldStopTxQueConsume === 1
    ) {
      oThis._stopPickingUpNewTasks(oThis.exTxTopicName);
    }
    return true;
  }
}

new ExecuteTransactionExecutable({ cronProcessId: +program.cronProcessId }).perform();

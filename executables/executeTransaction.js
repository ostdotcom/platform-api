'use strict';
/**
 * Factory class for workflowRouter.
 *
 * @module executables/workflowRouter/factory
 */
const program = require('commander');

const rootPrefix = '..',
  kwcConstant = require(rootPrefix + '/lib/globalConstant/kwc'),
  logger = require(rootPrefix + '/lib/logger/customConsoleLogger'),
  cronProcessesConstants = require(rootPrefix + '/lib/globalConstant/cronProcesses'),
  ChainSubscriberBase = require(rootPrefix + '/executables/rabbitmq/ChainSubscriberBase'),
  InitProcessKlass = require(rootPrefix + '/lib/executeTransactionManagement/initProcess'),
  CommandMessageProcessor = require(rootPrefix + '/lib/executeTransactionManagement/CommandMessageProcessor');

program.option('--cronProcessId <cronProcessId>', 'Cron table process ID').parse(process.argv);

program.on('--help', function() {
  logger.log('');
  logger.log('  Example:');
  logger.log('');
  logger.log('    node executables/executeTransaction.js --cronProcessId 15');
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
class ExecuteTransactionProcess extends ChainSubscriberBase {
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
    oThis.subscriptionData = {};
    oThis.initProcessResp = {};
    oThis.exTxTopicName = null;
    oThis.cMsgTopicName = null;
  }

  /**
   * Start the actual functionality of the cron.
   *
   * @returns {Promise<void>}
   *
   * @private
   */
  async _start() {
    const oThis = this;

    // Query to get queue_topic suffix & chainId
    oThis.initProcessResp = await new InitProcessKlass({ processId: cronProcessId }).perform();

    oThis._prepareData();

    if (oThis.initProcessResp.shouldStartTxQueConsume == 1) {
      await oThis._startSubscription(oThis.exTxTopicName);
    }
    await oThis._startSubscription(oThis.cMsgTopicName);

    return true;
  }

  /**
   * Prepare subscription data.
   *
   * @returns {{}}
   * @private
   */
  _prepareData() {
    const oThis = this,
      queueTopicSuffix = oThis.initProcessResp.processDetails.queueTopicSuffix;

    oThis.auxChainId = oThis.initProcessResp.processDetails.chainId;
    oThis.exTxTopicName = kwcConstant.exTxTopicName(oThis.auxChainId, queueTopicSuffix);
    oThis.cMsgTopicName = kwcConstant.commandMessageTopicName(oThis.auxChainId, queueTopicSuffix);

    let exTxQueueName = kwcConstant.exTxQueueName(oThis.auxChainId, queueTopicSuffix),
      cMsgQueueName = kwcConstant.commandMessageQueueName(oThis.auxChainId, queueTopicSuffix);

    oThis.subscriptionData[oThis.exTxTopicName] = {
      topicName: oThis.exTxTopicName,
      queueName: exTxQueueName,
      promiseQueueManager: null,
      unAckCount: 0,
      prefetchCount: oThis.prefetchCount,
      subscribed: 0
    };
    oThis.subscriptionData[oThis.cMsgTopicName] = {
      topicName: oThis.cMsgTopicName,
      queueName: cMsgQueueName,
      promiseQueueManager: null,
      unAckCount: 0,
      prefetchCount: 1,
      subscribed: 0
    };

    return oThis.subscriptionData;
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
      oThis.subscriptionData[oThis.exTxTopicName].unAckCount++;
    } else if (kind == kwcConstant.commandMsg) {
      oThis.subscriptionData[oThis.cMsgTopicName].unAckCount++;
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
      oThis.subscriptionData[oThis.exTxTopicName].unAckCount--;
    } else if (kind == kwcConstant.commandMsg) {
      oThis.subscriptionData[oThis.cMsgTopicName].unAckCount--;
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
      return oThis.subscriptionData[oThis.exTxTopicName].unAckCount;
    } else if (kind == kwcConstant.commandMsg) {
      return oThis.subscriptionData[oThis.cMsgTopicName].unAckCount;
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
    // Query in workflow_steps to get details pf parent id in message params.
    let msgParams = messageParams.message.payload,
      kind = messageParams.message.kind;

    console.log('_processMessage-------------------------.......\n', messageParams);

    if (kind == kwcConstant.executeTx) {
      logger.info('Message specific perform called.......\n');
      //message specific perform called.
    } else if (kind == kwcConstant.commandMsg) {
      logger.info('Command specific perform called.......\n');
      let commandMessageParams = {
        chainId: oThis.auxChainId,
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
      await oThis._startSubscription(oThis.exTxTopicName);
    } else if (
      commandProcessorResponse &&
      commandProcessorResponse.data.shouldStopTxQueConsume &&
      commandProcessorResponse.data.shouldStopTxQueConsume === 1
    ) {
      oThis.stopPickingUpNewTasks(oThis.exTxTopicName);
    }
    return true;
  }
}

new ExecuteTransactionProcess({ cronProcessId: +program.cronProcessId }).perform();
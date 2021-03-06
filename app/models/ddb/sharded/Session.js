'use strict';

const OSTBase = require('@ostdotcom/base'),
  InstanceComposer = OSTBase.InstanceComposer;

const rootPrefix = '../../../..',
  util = require(rootPrefix + '/lib/util'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  Base = require(rootPrefix + '/app/models/ddb/sharded/Base'),
  coreConstants = require(rootPrefix + '/config/coreConstants'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  logger = require(rootPrefix + '/lib/logger/customConsoleLogger'),
  pagination = require(rootPrefix + '/lib/globalConstant/pagination'),
  sessionConstants = require(rootPrefix + '/lib/globalConstant/session');

/**
 * Class for session model.
 *
 * @class
 */
class Session extends Base {
  /**
   * Constructor for session model.
   *
   * @param {Object} params
   * @param {Number} params.consistentRead: (1,0)
   * @param {Number} params.shardNumber
   *
   * @constructor
   */
  constructor(params) {
    super(params);
  }

  /**
   * Mapping of long column names to their short names.
   *
   * @returns {{}}
   */
  get longToShortNamesMap() {
    const oThis = this;

    return {
      userId: 'uid',
      address: 'adr',
      expirationHeight: 'eh',
      spendingLimit: 'sl',
      knownAddressId: 'kai',
      status: 's',
      updatedTimestamp: 'uts'
    };
  }

  /**
   * Mapping of long column names to their short names.
   *
   * @returns {Object|*}
   */
  get shortToLongNamesMap() {
    const oThis = this;

    return util.invert(oThis.longToShortNamesMap);
  }

  /**
   * shortNameToDataType
   * @return {{}}
   */
  get shortNameToDataType() {
    return {
      uid: 'S',
      adr: 'S',
      eh: 'N',
      sl: 'N',
      kai: 'N',
      s: 'N',
      uts: 'N'
    };
  }

  /**
   * Returns the table name template.
   *
   * @returns {String}
   */
  tableNameTemplate() {
    return '{{chainId}}_sessions_{{shardNumber}}';
  }

  /**
   * Primary key of the table.
   *
   * @param params
   * @returns {Object}
   * @private
   */
  _keyObj(params) {
    const oThis = this,
      keyObj = {};

    let userIdShortName = oThis.shortNameFor('userId'),
      addressShortName = oThis.shortNameFor('address');

    keyObj[userIdShortName] = { [oThis.shortNameToDataType[userIdShortName]]: params['userId'].toString() };
    keyObj[addressShortName] = { [oThis.shortNameToDataType[addressShortName]]: params['address'].toString() };

    return keyObj;
  }

  /**
   * Create table params
   *
   * @returns {Object}
   */
  tableSchema() {
    const oThis = this,
      userIdShortName = oThis.shortNameFor('userId'),
      addressShortName = oThis.shortNameFor('address');

    const tableSchema = {
      TableName: oThis.tableName(),
      KeySchema: [
        {
          AttributeName: userIdShortName,
          KeyType: 'HASH'
        }, //Partition key
        {
          AttributeName: addressShortName,
          KeyType: 'RANGE'
        } //Sort key
      ],
      AttributeDefinitions: [
        { AttributeName: userIdShortName, AttributeType: oThis.shortNameToDataType[userIdShortName] },
        { AttributeName: addressShortName, AttributeType: oThis.shortNameToDataType[addressShortName] }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1
      },
      SSESpecification: {
        Enabled: false
      }
    };

    return tableSchema;
  }

  /**
   * Creates new session in Dynamo
   *
   * @param {Object} params
   *
   * @return {Promise}
   */
  async createSession(params) {
    const oThis = this,
      shortNameForUserId = oThis.shortNameFor('userId'),
      shortNameForAddress = oThis.shortNameFor('address');

    let conditionalExpression =
      'attribute_not_exists(' + shortNameForUserId + ') AND attribute_not_exists(' + shortNameForAddress + ')';

    return oThis.putItem(params, conditionalExpression);
  }

  /**
   * Get session details.
   *
   * @param {Object} params
   * @param {Integer} params.userId - uuid
   * @param {Array} params.addresses - array of addresses
   *
   * @return {Promise<void>}
   */
  async getSessionDetails(params) {
    const oThis = this;

    let keyObjArray = [];
    for (let index = 0; index < params['addresses'].length; index++) {
      keyObjArray.push(
        oThis._keyObj({
          userId: params.userId,
          address: params.addresses[index]
        })
      );
    }

    let response = await oThis.batchGetItem(keyObjArray, 'address').catch(function(err) {
      return Promise.reject(
        oThis._prepareErrorObject({
          errorObject: err,
          internalErrorCode: 'a_m_d_s_s_3',
          apiErrorIdentifier: 'session_details_fetch_failed',
          debugOptions: { params: params, err: err }
        })
      );
    });

    return response;
  }

  /**
   * Get paginated data
   *
   * @param {Number} userId
   * @param {Number} page  - page number
   * @param {Number} limit
   * @param [lastEvaluatedKey] - optional
   *
   * @returns {Promise<*>}
   */
  async getSessionsAddresses(userId, page, limit, lastEvaluatedKey) {
    const oThis = this,
      shortNameForUserId = oThis.shortNameFor('userId'),
      dataTypeForUserId = oThis.shortNameToDataType[shortNameForUserId];

    let queryParams = {
      TableName: oThis.tableName(),
      KeyConditionExpression: `${shortNameForUserId} = :uid`,
      ExpressionAttributeValues: {
        ':uid': { [dataTypeForUserId]: userId.toString() }
      },
      ProjectionExpression: oThis.shortNameFor('address'),
      Limit: limit,
      ScanIndexForward: false
    };
    if (lastEvaluatedKey) {
      queryParams['ExclusiveStartKey'] = lastEvaluatedKey;
    }

    let response = await oThis.ddbServiceObj.query(queryParams);

    if (response.isFailure()) {
      return Promise.reject(
        oThis._prepareErrorObject({
          errorObject: response,
          internalErrorCode: 'a_m_d_s_s_2',
          apiErrorIdentifier: 'session_address_fetch_failed',
          debugOptions: { userId: userId }
        })
      );
    }

    let row,
      formattedRow,
      addresses = [];

    for (let i = 0; i < response.data.Items.length; i++) {
      row = response.data.Items[i];
      formattedRow = oThis._formatRowFromDynamo(row);
      addresses.push(formattedRow.address);
    }

    let responseData = {
      addresses: addresses
    };

    if (response.data.LastEvaluatedKey) {
      responseData[pagination.nextPagePayloadKey] = {
        [pagination.paginationIdentifierKey]: {
          lastEvaluatedKey: response.data.LastEvaluatedKey,
          page: page + 1, //NOTE: page number is used for pagination cache. Not for client communication or query.
          limit: limit
        }
      };
    }

    return responseHelper.successWithData(responseData);
  }

  /**
   * Update session status only
   *
   * @param params
   * @return {Promise}
   */
  async updateSessionStatus(params) {
    const oThis = this,
      shortNameForUserId = oThis.shortNameFor('userId'),
      shortNameForAddress = oThis.shortNameFor('address');

    // Allow only status to be updated
    let updateParams = {
      userId: params.userId,
      address: params.address,
      status: params.status,
      updatedTimestamp: params.updatedTimestamp
    };

    let conditionalExpression =
      'attribute_exists(' + shortNameForUserId + ') AND attribute_exists(' + shortNameForAddress + ')';

    return oThis.updateItem(updateParams, conditionalExpression);
  }

  /**
   * Update status of session from initial status to final status.
   *
   * @param {String} userId
   * @param {String} sessionAddress
   * @param {String} initialStatus
   * @param {String} finalStatus
   *
   * @return {Promise<void>}
   */
  async updateStatusFromInitialToFinal(userId, sessionAddress, initialStatus, finalStatus) {
    const oThis = this,
      shortNameForUserId = oThis.shortNameFor('userId'),
      shortNameForAddress = oThis.shortNameFor('address'),
      shortNameForStatus = oThis.shortNameFor('status'),
      shortNameForTimeStamp = oThis.shortNameFor('updatedTimestamp'),
      dataTypeForTimeStamp = oThis.shortNameToDataType[shortNameForTimeStamp],
      dataTypeForStatus = oThis.shortNameToDataType[shortNameForStatus],
      initialStatusInt = sessionConstants.invertedSessionStatuses[initialStatus],
      finalStatusInt = sessionConstants.invertedSessionStatuses[finalStatus];

    const updateQuery = {
      TableName: oThis.tableName(),
      Key: oThis._keyObj({ userId: userId, address: sessionAddress }),
      ConditionExpression:
        'attribute_exists(' +
        shortNameForUserId +
        ') AND attribute_exists(' +
        shortNameForAddress +
        ')' +
        ' AND #initialStatus = :initialStatus',
      ExpressionAttributeNames: {
        '#initialStatus': shortNameForStatus,
        '#finalStatus': shortNameForStatus,
        '#updatedTimeStamp': shortNameForTimeStamp
      },
      ExpressionAttributeValues: {
        ':initialStatus': { [dataTypeForStatus]: initialStatusInt },
        ':finalStatus': { [dataTypeForStatus]: finalStatusInt },
        ':updatedTimeStamp': { [dataTypeForTimeStamp]: basicHelper.getCurrentTimestampInSeconds().toString() }
      },
      UpdateExpression: 'SET #finalStatus = :finalStatus, #updatedTimeStamp = :updatedTimeStamp',
      ReturnValues: 'ALL_NEW'
    };

    let updateQueryResponse = await oThis.ddbServiceObj.updateItem(updateQuery);

    if (updateQueryResponse.internalErrorCode.endsWith('ConditionalCheckFailedException')) {
      return responseHelper.error({
        internal_error_identifier: 'a_m_d_s_s_1',
        api_error_identifier: 'conditional_check_failed',
        debug_options: { error: updateQueryResponse.toHash() }
      });
    }

    if (updateQueryResponse.isFailure()) {
      return oThis._prepareErrorObject({
        errorObject: updateQueryResponse,
        internalErrorCode: 'a_m_d_s_s_2',
        apiErrorIdentifier: 'session_status_update_failed',
        debugOptions: { userId: userId, address: sessionAddress }
      });
    }

    // Clear cache
    await Session.afterUpdate(oThis.ic(), { userId: userId, address: sessionAddress });

    updateQueryResponse = oThis._formatRowFromDynamo(updateQueryResponse.data.Attributes);

    return Promise.resolve(responseHelper.successWithData(oThis._sanitizeRowFromDynamo(updateQueryResponse)));
  }

  /**
   *
   * method to perform extra formatting
   *
   * @param dbRow
   * @return {Object}
   * @private
   */
  _sanitizeRowFromDynamo(dbRow) {
    dbRow['status'] = sessionConstants.sessionStatuses[dbRow['status']];
    return dbRow;
  }

  /**
   *
   * method to perform extra formatting
   *
   * @param dbRow
   * @return {Object}
   * @private
   */
  _sanitizeRowForDynamo(dbRow) {
    dbRow['status'] = sessionConstants.invertedSessionStatuses[dbRow['status']];
    dbRow['address'] = basicHelper.sanitizeAddress(dbRow['address']);

    if (!dbRow['updatedTimestamp']) {
      dbRow['updatedTimestamp'] = basicHelper.getCurrentTimestampInSeconds().toString();
    }
    return dbRow;
  }

  /**
   * afterUpdate - Method to implement any after update actions
   *
   * @param ic
   * @param params
   * @param params.userId
   * @param params.addresses - Array - Session addresses optional parameter
   * @param params.address - Single address - optional parameter
   *
   * @return {Promise<void>}
   */
  static async afterUpdate(ic, params) {
    let sessionAddresses = params.addresses || [params.address];

    if (sessionAddresses.length) {
      require(rootPrefix + '/lib/cacheManagement/chainMulti/SessionsByAddress');
      let SessionsByAddressCache = ic.getShadowedClassFor(coreConstants.icNameSpace, 'SessionsByAddressCache'),
        sessionsByAddressCache = new SessionsByAddressCache({
          userId: params.userId,
          addresses: sessionAddresses
        });

      await sessionsByAddressCache.clear();
    }

    require(rootPrefix + '/lib/cacheManagement/chain/UserSessionAddress');
    let UserSessionAddressCache = ic.getShadowedClassFor(coreConstants.icNameSpace, 'UserSessionAddressCache'),
      userSessionAddressCache = new UserSessionAddressCache({
        userId: params.userId
      });

    await userSessionAddressCache.clear();

    logger.info('Session caches cleared.');
    return responseHelper.successWithData({});
  }

  /**
   * Subclass to return its own class here
   *
   * @returns {object}
   */
  get subClass() {
    return Session;
  }
}

InstanceComposer.registerAsShadowableClass(Session, coreConstants.icNameSpace, 'SessionModel');

module.exports = {};

'use strict';

const rootPrefix = '../../..',
  logger = require(rootPrefix + '/lib/logger/customConsoleLogger'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  AddCronProcessService = require(rootPrefix + '/lib/addCronProcess'),
  fs = require('fs');

/**
 * Class for inserting cron entries into saas db
 *
 * @class
 */
class CreateCron {
  /**
   * Constructor
   *
   * @param {String} inputJsonFile - Input JSON file path
   * @param {String} outputJsonFile -  Output JSON file path
   *
   * @constructor
   */
  constructor(inputJsonFile, outputJsonFile) {
    const oThis = this;
    oThis.jsonData = require(inputJsonFile);
    oThis.outputFile = outputJsonFile;
  }

  /**
   *
   * Perform
   *
   * @return {Promise<result>}
   *
   */
  perform() {
    const oThis = this;

    return oThis._asyncPerform().catch(function(error) {
      if (responseHelper.isCustomResult(error)) {
        return error;
      } else {
        logger.error('devops/utils/InsertCron.js::perform::catch', error);
        return oThis._getRespError('do_u_cs_ic_p1');
      }
    });
  }

  /**
   *
   * async perform
   *
   * @return {Promise<result>}
   *
   */
  async _asyncPerform() {
    const oThis = this;

    for (let i = 0; i < oThis.jsonData.length; i++) {
      let cron = oThis.jsonData[i],
        dbParams = cron['db_params'];

      // Iterate over next when cron process entry already present
      if (cron['identifier']) {
        continue;
      }

      // Add cron process entry in DB
      let result = await oThis.addCronProcess(dbParams);

      if (result['insertId'] > 0) {
        cron['identifier'] = result['insertId'];
      }
    }

    fs.writeFileSync(oThis.outputFile, JSON.stringify(oThis.jsonData));

    return responseHelper.successWithData({ outputJson: oThis.jsonData });
  }

  /**
   * Generate Error response
   *
   * @param code {String} - Error internal identifier
   *
   * @returns {Promise<void>}
   * @private
   */
  async _getRespError(code) {
    return responseHelper.error({
      internal_error_identifier: code,
      api_error_identifier: 'something_went_wrong',
      debug_options: {}
    });
  }

  /**
   *
   * Add cron process
   *
   * @param {Object} dbParams - Create parameters
   *
   * @returns {Promise<void>}
   *
   */
  async addCronProcess(dbParams) {
    let serviceObj = new AddCronProcessService(dbParams);
    return serviceObj.perform();
  }
}

module.exports = CreateCron;

'use strict';

const rootPrefix = '..',
  apiSignature = require(rootPrefix + '/lib/globalConstant/apiSignature'),
  apiName = require(rootPrefix + '/lib/globalConstant/apiName');

let getRequestConfig, getRequestRegexes, postRequestConfig, postRequestRegexes;

class ApiAuthentication {
  get getRequestConfig() {
    if (getRequestConfig) {
      return getRequestConfig;
    }
    getRequestConfig = {
      [apiName.getChain]: {
        supportedSignatureKinds: [apiSignature.hmacKind, apiSignature.personalSignKind],
        route: '/chains/:chain_id/'
      },
      [apiName.getPricePoints]: {
        supportedSignatureKinds: [apiSignature.hmacKind, apiSignature.personalSignKind],
        route: '/chains/:chain_id/price-points/'
      },
      [apiName.getToken]: {
        supportedSignatureKinds: [apiSignature.hmacKind, apiSignature.personalSignKind],
        route: '/tokens/'
      },
      [apiName.getRules]: {
        supportedSignatureKinds: [apiSignature.hmacKind, apiSignature.personalSignKind],
        route: '/rules/'
      },
      [apiName.getUserList]: {
        supportedSignatureKinds: [apiSignature.hmacKind],
        route: '/users/'
      },
      [apiName.getUser]: {
        supportedSignatureKinds: [apiSignature.hmacKind, apiSignature.personalSignKind],
        route: '/users/:user_id/'
      },
      [apiName.getUserDevices]: {
        supportedSignatureKinds: [apiSignature.hmacKind],
        route: '/users/:user_id/devices/'
      },
      [apiName.getUserDevice]: {
        supportedSignatureKinds: [apiSignature.hmacKind, apiSignature.personalSignKind],
        route: '/users/:user_id/devices/:device_address/'
      },
      [apiName.getUserDeviceManager]: {
        supportedSignatureKinds: [apiSignature.hmacKind, apiSignature.personalSignKind],
        route: '/users/:user_id/device-managers/'
      },
      [apiName.getUserSessions]: {
        supportedSignatureKinds: [apiSignature.hmacKind],
        route: '/users/:user_id/sessions/'
      },
      [apiName.getUserSession]: {
        supportedSignatureKinds: [apiSignature.hmacKind, apiSignature.personalSignKind],
        route: '/users/:user_id/sessions/:session_address/'
      },
      // [apiName.getTokenHolder]: {
      //   supportedSignatureKinds: [apiSignature.hmacKind, apiSignature.personalSignKind],
      //   route: '/users/:user_id/token-holders/'
      // },
      [apiName.getUserSalt]: {
        supportedSignatureKinds: [apiSignature.personalSignKind],
        route: '/users/:user_id/salts/'
      },
      [apiName.getTransaction]: {
        supportedSignatureKinds: [apiSignature.hmacKind, apiSignature.personalSignKind],
        route: '/users/:user_id/transactions/:transaction_id/'
      },
      [apiName.getUserTransactions]: {
        supportedSignatureKinds: [apiSignature.hmacKind, apiSignature.personalSignKind],
        route: '/users/:user_id/transactions/'
      },
      [apiName.getUserBalance]: {
        supportedSignatureKinds: [apiSignature.hmacKind, apiSignature.personalSignKind],
        route: '/users/:user_id/balance/'
      },
      [apiName.getRecoveryOwner]: {
        supportedSignatureKinds: [apiSignature.personalSignKind],
        route: '/users/:user_id/recovery-owners/:recovery_owner_address/'
      }
      // Note: - Urls should end with a slash. Add config above this.
    };
    return getRequestConfig;
  }

  get postRequestConfig() {
    if (postRequestConfig) {
      return postRequestConfig;
    }
    postRequestConfig = {
      [apiName.createUser]: {
        supportedSignatureKinds: [apiSignature.hmacKind],
        route: '/users/'
      },
      [apiName.activateUser]: {
        supportedSignatureKinds: [apiSignature.personalSignKind, apiSignature.hmacKind],
        route: '/users/:user_id/activate-user/'
      },
      [apiName.createUserDevice]: {
        supportedSignatureKinds: [apiSignature.hmacKind],
        route: '/users/:user_id/devices/'
      },
      [apiName.postAuthorizeDevice]: {
        supportedSignatureKinds: [apiSignature.personalSignKind],
        route: '/users/:user_id/devices/authorize/'
      },
      [apiName.postRevokeDevice]: {
        supportedSignatureKinds: [apiSignature.personalSignKind],
        route: '/users/:user_id/devices/revoke/'
      },
      [apiName.postAuthorizeSession]: {
        supportedSignatureKinds: [apiSignature.personalSignKind],
        route: '/users/:user_id/sessions/authorize/'
      },
      [apiName.postRevokeSession]: {
        supportedSignatureKinds: [apiSignature.personalSignKind],
        route: '/users/:user_id/sessions/revoke/'
      },
      [apiName.executeTransactionFromUser]: {
        supportedSignatureKinds: [apiSignature.personalSignKind],
        route: '/users/:user_id/transactions/'
      },
      [apiName.executeTransactionFromCompany]: {
        supportedSignatureKinds: [apiSignature.hmacKind],
        route: '/users/:user_id/transactions/'
      },
      [apiName.initiateRecovery]: {
        supportedSignatureKinds: [apiSignature.personalSignKind],
        route: '/users/:user_id/devices/initiate-recovery/'
      },
      [apiName.abortRecovery]: {
        supportedSignatureKinds: [apiSignature.personalSignKind],
        route: '/users/:user_id/devices/abort-recovery/'
      },
      [apiName.resetRecoveryOwner]: {
        supportedSignatureKinds: [apiSignature.personalSignKind],
        route: '/users/:user_id/recovery-owners/'
      }
      // Note: - Urls should end with a slash. Add config above this.
    };
    return postRequestConfig;
  }

  get getRequestsDataExtractionRegex() {
    const oThis = this;
    if (getRequestRegexes) {
      return getRequestRegexes;
    }
    getRequestRegexes = oThis.dataExtractionRegexGenerator(oThis.getRequestConfig);
    return getRequestRegexes;
  }

  get postRequestsDataExtractionRegex() {
    const oThis = this;
    if (postRequestRegexes) {
      return postRequestRegexes;
    }
    postRequestRegexes = oThis.dataExtractionRegexGenerator(oThis.postRequestConfig);
    return postRequestRegexes;
  }

  dataExtractionRegexGenerator(globalConfig) {
    let config,
      buffer,
      regexes = {};

    for (let apiName in globalConfig) {
      config = globalConfig[apiName];

      buffer = {
        apiName: apiName,
        supportedSignatureKinds: config['supportedSignatureKinds'],
        regExMatches: ['url'],
        regExUrl: '^' + config['route'].replace('/', '/') + '$'
      };

      let dynamicVariables = config['route'].match(RegExp(':([^/]+)', 'gi')) || [];

      for (let i = 0; i < dynamicVariables.length; i++) {
        buffer.regExMatches.push(dynamicVariables[i].replace(':', ''));
        buffer.regExUrl = buffer.regExUrl.replace(dynamicVariables[i], '([^/]+)');
      }

      buffer.regExUrl = new RegExp(buffer.regExUrl, 'i');

      regexes[config['route']] = buffer;
    }

    return regexes;
  }
}

module.exports = new ApiAuthentication();

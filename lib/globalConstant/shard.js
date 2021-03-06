'use strict';
/**
 * Shards model ddb constants.
 *
 * @module lib/globalConstant/shard
 */

const rootPrefix = '../..',
  util = require(rootPrefix + '/lib/util');

let invertedEntityKinds, entityKinds;

class ShardConstants {
  get userEntityKind() {
    return 'user';
  }

  get deviceEntityKind() {
    return 'device';
  }

  get recoveryOwnerAddressEntityKind() {
    return 'recoveryOwnerAddress';
  }

  get sessionEntityKind() {
    return 'session';
  }

  get balanceEntityKind() {
    return 'balance';
  }

  get entityKinds() {
    const oThis = this;
    if (entityKinds) {
      return entityKinds;
    }
    entityKinds = {
      '1': oThis.userEntityKind,
      '2': oThis.deviceEntityKind,
      '3': oThis.recoveryOwnerAddressEntityKind,
      '4': oThis.sessionEntityKind,
      '5': oThis.balanceEntityKind
    };
    return entityKinds;
  }

  get invertedEntityKinds() {
    const oThis = this;
    if (invertedEntityKinds) {
      return invertedEntityKinds;
    }
    invertedEntityKinds = util.invert(oThis.entityKinds);
    return invertedEntityKinds;
  }

  /**
   *
   * from shard number return table suffixes
   *
   * @param number
   * @return {string}
   */
  getShardSuffixFromShardNumber(number) {
    number = parseInt(number);
    if (number > 100) {
      return number;
    } else if (number > 10) {
      return `0${number}`;
    } else {
      return `00${number}`;
    }
  }
}

module.exports = new ShardConstants();

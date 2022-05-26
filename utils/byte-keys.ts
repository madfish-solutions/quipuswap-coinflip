import { packDataBytes } from '@taquito/michel-codec';
import { Schema } from '@taquito/michelson-encoder';
import {
  b58decode,
  validateAddress,
  ValidationResult
} from '@taquito/utils';
import {
  MichelsonV1Expression,
  MichelsonV1ExpressionExtended
} from '@taquito/rpc';
import BigNumber from 'bignumber.js';

interface TezAsset {
  tez: Symbol;
}

interface FA2TokenAsset {
  fa2: {
    address: string;
    id: BigNumber;
  }
}

type Asset = TezAsset | FA2TokenAsset;

const assetSchema = new Schema({
  prim: 'or',
  args: [
    {
      prim: 'pair',
      args: [
        { prim: 'address', annots: ['%address'] },
        { prim: 'nat', annots: ['%id'] }
      ],
      annots: ['%fa2']
    },
    { prim: 'unit', annots: ['%tez'] }
  ],
  annots: ['%asset']
});

function replaceAddressesWithBytes(expr: MichelsonV1Expression) {
  if (expr instanceof Array) {
    return expr.map(value => replaceAddressesWithBytes(value));
  }

  if (
    'string' in expr &&
    (validateAddress(expr.string) === ValidationResult.VALID)
  ) {
    return { bytes: b58decode(expr.string) };
  }

  if ('int' in expr || 'bytes' in expr || 'string' in expr) {
    return expr;
  }

  const extendedExpr = expr as MichelsonV1ExpressionExtended;
  if ('args' in extendedExpr) {
    extendedExpr.args = replaceAddressesWithBytes(extendedExpr.args); 
  }

  return extendedExpr;
}

function getPackedBytesKey<T>(data: T, schema: Schema) {
  const keyToEncode = replaceAddressesWithBytes(schema.Encode(data));

  return packDataBytes(keyToEncode).bytes;
}

export function getAssetKey(asset: Asset) {
  return getPackedBytesKey(asset, assetSchema);
}

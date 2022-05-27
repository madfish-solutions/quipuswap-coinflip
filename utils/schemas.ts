import { Schema } from '@taquito/michelson-encoder';

export const assetSchema = new Schema({
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

export const addressAssetIdPairSchema = new Schema({
  prim: 'pair',
  args: [
    { prim: 'address', annots: ['%address'] },
    { prim: 'nat', annots: ['%asset_id'] }
  ]
});

export const assetRecordSchema = new Schema({
  prim: "pair",
  args: [
    {
      prim: "or",
      args: [
        {
          prim: "pair",
          args: [
            {
              prim: "address",
              annots: ["%address"]
            },
            {
              prim: "nat",
              annots: ["%id"]
            }
          ],
          annots: ["%fa2"]
        },
        {
          prim: "unit",
          annots: ["%tez"]
        }
      ],
      annots: ["%asset"]
    },
    {
      prim: "pair",
      args: [
        {
          prim: "nat",
          annots: ["%payout_quot_f"]
        },
        {
          prim: "pair",
          args: [
            {
              prim: "nat",
              annots: ["%bank"]
            },
            {
              prim: "pair",
              args: [
                {
                  prim: "nat",
                  annots: ["%max_bet_percent_f"]
                },
                {
                  prim: "pair",
                  args: [
                    {
                      prim: "nat",
                      annots: ["%total_won_amt"]
                    },
                    {
                      prim: "pair",
                      args: [
                        {
                          prim: "nat",
                          annots: ["%total_lost_amt"]
                        },
                        {
                          prim: "pair",
                          args: [
                            {
                              prim: "nat",
                              annots: ["%total_bets_amt"]
                            },
                            {
                              prim: "pair",
                              args: [
                                {
                                  prim: "nat",
                                  annots: ["%games_count"]
                                },
                                {
                                  prim: "bool",
                                  annots: ["%paused"]
                                }
                              ]
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
});

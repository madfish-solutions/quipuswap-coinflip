
from unittest import TestCase
import json
from pprint import pprint
from constants import *

from helpers import *

from pytezos import ContractInterface, MichelsonRuntimeError

class CoinflipTest(TestCase):

    @classmethod
    def setUpClass(cls):
        cls.maxDiff = None

        text = open("./build/coinflip.json").read()
        code = json.loads(text)

        cls.ct = ContractInterface.from_micheline(code["michelson"])

        storage = cls.ct.storage.dummy()
        storage["admin"] = admin 
        storage["server"] = server

        cls.init_storage = storage

    def test_asset_add(self):
        chain = LocalChain(storage=self.init_storage)

        add_asset = self.ct.add_asset(
            payout_quot_f=int(1.5 * 1e18),
            max_bet_percent_f=int(0.3 * 1e18),
            asset=token_a_fa2)
        res = chain.execute(add_asset, sender=admin)

        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 0)

        res = chain.execute(self.ct.add_asset_bank(100_000, 0), sender=admin)

        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 1)
        self.assertEqual(transfers[0]["amount"], 100_000)
        self.assertEqual(transfers[0]["source"], admin)
        self.assertEqual(transfers[0]["destination"], contract_self_address)

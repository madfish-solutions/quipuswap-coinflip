
from re import L
from unittest import TestCase
import json
from pprint import pprint
from constants import *

from helpers import *

from pytezos import ContractInterface, MichelsonRuntimeError

TEZ = {"tez" : None}

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

    def test_tez_asset_add(self):
        chain = MockChain(storage=self.init_storage)

        add_asset = self.ct.add_asset(
            payout_quot_f=int(1.5 * 1e18),
            max_bet_percent_f=int(0.3 * 1e18),
            asset=TEZ)
        res = chain.execute(add_asset, sender=admin)

        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 0)

        with self.assertRaises(MichelsonRuntimeError):
            chain.execute(self.ct.add_asset_bank(100_000, 0), sender=admin, amount=0)

        with self.assertRaises(MichelsonRuntimeError):
            chain.execute(self.ct.add_asset_bank(100_000, 0), sender=admin, amount=42424)

        res = chain.execute(self.ct.add_asset_bank(100_000, 0), sender=admin, amount=100_000)

        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 0)

    def test_tez_bet_won(self):
        chain = MockChain(storage=self.init_storage)

        add_asset = self.ct.add_asset(
            payout_quot_f=int(1.5 * 1e18),
            max_bet_percent_f=int(0.3 * 1e18),
            asset=TEZ)
        res = chain.execute(add_asset, sender=admin)

        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 0)

        res = chain.execute(self.ct.add_asset_bank(100_000, 0), sender=admin, amount=100_000)

        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 0)

        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(self.ct.bet(0, 30_000, {"head" : None}), amount=0)

        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(self.ct.bet(0, 30_000, {"head" : None}), amount=300)

        res = chain.execute(self.ct.bet(0, 30_000, {"head" : None}), amount=30_000)
        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 0)

        res = chain.execute(self.ct.reveal([{"game_id": 0, "random_value": 25}]), sender=server)
        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 1)
        self.assertEqual(transfers[0]["amount"], 45_000)
        self.assertEqual(transfers[0]["source"], contract_self_address)
        self.assertEqual(transfers[0]["destination"], alice)
        self.assertEqual(transfers[0]["type"], "tez")
        
        # res = chain.execute(self.ct.bet(0, 10_000, {"head" : None}))
        # can't reveal already revealed
        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(self.ct.reveal([{"game_id": 0, "random_value": 25}]), sender=server)

        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(self.ct.remove_asset_bank(85_001, 0), sender=admin)
        res = chain.execute(self.ct.remove_asset_bank(85_000, 0), sender=admin)
        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 1)
        self.assertEqual(transfers[0]["amount"], 85_000)
        self.assertEqual(transfers[0]["source"], contract_self_address)
        self.assertEqual(transfers[0]["destination"], admin)
        self.assertEqual(transfers[0]["type"], "tez")


    def test_tez_bet_lost(self):
        chain = MockChain(storage=self.init_storage)

        add_asset = self.ct.add_asset(
            payout_quot_f=int(1.5 * 1e18),
            max_bet_percent_f=int(0.3 * 1e18),
            asset=TEZ)
        res = chain.execute(add_asset, sender=admin)

        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 0)

        res = chain.execute(self.ct.add_asset_bank(100_000, 0), sender=admin, amount=100_000)

        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 0)

        res = chain.execute(self.ct.bet(0, 30_000, {"tail" : None}), amount=30_000)
        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 0)

        res = chain.execute(self.ct.reveal([{"game_id": 0, "random_value": 25}]), sender=server)
        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 0)

        res = chain.execute(self.ct.remove_asset_bank(130_000, 0), sender=admin)
        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(self.ct.remove_asset_bank(1, 0), sender=admin)


    def test_tez_reveal_after_bank_removed(self):
        chain = MockChain(storage=self.init_storage)

        add_asset = self.ct.add_asset(
            payout_quot_f=int(1.5 * 1e18),
            max_bet_percent_f=int(0.3 * 1e18),
            asset=TEZ)
        res = chain.execute(add_asset, sender=admin)

        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 0)

        res = chain.execute(self.ct.add_asset_bank(100_000, 0), sender=admin, amount=100_000)

        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 0)

        res = chain.execute(self.ct.bet(0, 30_000, {"head" : None}), amount=30_000, sender=alice, source=alice)
        res = chain.execute(self.ct.bet(0, 5_000, {"head" : None}), amount=5_000, sender=alice, source=alice)

        # leave only 10k which is not enough for payout
        res = chain.execute(self.ct.remove_asset_bank(90_000, 0), sender=admin)
        
        with self.assertRaises(MichelsonRuntimeError) as error:
            res = chain.execute(self.ct.reveal([{"game_id": 0, "random_value": 25}]), sender=server)
        # TODO assert error text
        self.assertIn("cannot-pay", error.exception.args[-1])

        # second game lost adding 5k to the bank
        res = chain.execute(self.ct.reveal([{"game_id": 1, "random_value": 30}]), sender=server)

        # now it is 15k in the bank which is enough to win first reveal
        res = chain.execute(self.ct.reveal([{"game_id": 0, "random_value": 20}]), sender=server)

        # all bank funds are drained
        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(self.ct.remove_asset_bank(1, 0), sender=admin)

    def test_tez_network_fee(self):
        chain = MockChain(storage=self.init_storage)

        add_asset = self.ct.add_asset(
            payout_quot_f=int(1.5 * 1e18),
            max_bet_percent_f=int(0.3 * 1e18),
            asset=TEZ)
        chain.execute(add_asset, sender=admin)

        chain.execute(self.ct.add_asset_bank(100_000, 0), sender=admin, amount=100_000)
        chain.execute(self.ct.set_network_fee(1000), sender=admin)

        with self.assertRaises(MichelsonRuntimeError):
            chain.execute(self.ct.bet(0, 30_000, {"head" : None}))

        with self.assertRaises(MichelsonRuntimeError):
            chain.execute(self.ct.bet(0, 30_000, {"head" : None}), amount=1001)

        # exactly 30k is not enough since we have to cover network fee
        with self.assertRaises(MichelsonRuntimeError):
            chain.execute(self.ct.bet(0, 30_000, {"head" : None}), amount=30_000)
        
        chain.execute(self.ct.bet(0, 30_000, {"head" : None}), amount=31000, sender=alice)
        chain.execute(self.ct.bet(0, 1, {"head" : None}), amount=1001, sender=bob)

        res = chain.execute(self.ct.reveal([
            {"game_id": 0, "random_value": 25},
            {"game_id": 1, "random_value": 25}
        ]), sender=server)
        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 2)
        self.assertEqual(transfers[0]["amount"], 1)
        self.assertEqual(transfers[0]["source"], contract_self_address)
        self.assertEqual(transfers[0]["destination"], bob)
        self.assertEqual(transfers[0]["type"], "tez")
        self.assertEqual(transfers[1]["amount"], 45_000)
        self.assertEqual(transfers[1]["source"], contract_self_address)
        self.assertEqual(transfers[1]["destination"], alice)
        self.assertEqual(transfers[1]["type"], "tez")

        res = chain.execute(self.ct.withdraw_network_fee(2_000), sender=admin)
        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 1)
        self.assertEqual(transfers[0]["amount"], 2_000)
        self.assertEqual(transfers[0]["source"], contract_self_address)
        self.assertEqual(transfers[0]["destination"], admin)
        self.assertEqual(transfers[0]["type"], "tez")

        # no more fee to withdraw
        with self.assertRaises(MichelsonRuntimeError):
            chain.execute(self.ct.withdraw_network_fee(1), sender=admin)
            


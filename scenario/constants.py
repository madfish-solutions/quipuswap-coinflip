PRECISION = 1_000_000
A_CONST = 1_000_000

TEZOS_PRECISION = int(1e6)
BITCOIN_PRECISION = int(1e8)
ETH_PRECISION = int(1e18)

FAR_FUTURE = int(1e10)

MIN_RAMP_TIME=86_400

dex_core = "KT18fp5rcTW7mbWDmzFwjLDUhs5MeJmagDSZ"
server = "KT19kgnqC5VWoxktLRdRUERbyUPku9YioE8W"

token_a_address = "KT18amZmM5W7qDWVt2pH6uj7sCEd3kbzLrHT"
token_b_address = "KT1AxaBxkFLCUi3f8rdDAAxBKHfzY8LfKDRA"
token_c_address = "KT1XXAavg3tTj12W1ADvd3EEnm1pu6XTmiEF"
token_d_address = "KT1PQ8TMzGMfViRq4tCMFKD2QF5zwJnY67Xn"
token_e_address = "KT1X1LgNkQShpF9nRLYw3Dgdy4qp38MX617z"

token_a_id = 7
token_b_id = 66

token_a_fa12 = ("fa12", token_a_address)
token_a_fa2 = {
    "fa2": {
            "address": token_a_address,
            "id": token_a_id
        }
    }

token_b_fa2 = {
    "fa2": {
            "address": token_b_address,
            "id": token_b_id
        }
    }

token_c_fa12 = ("fa12", token_c_address)
token_d_fa12 = ("fa12", token_d_address)


vr = {
    f"{dex_core}%get_total_supply": [{"request": 0, "total_supply": 100}],
    f"{dex_core}%get_collecting_period": 10,
}

factory = "KT1LzyPS8rN375tC31WPAVHaQ4HyBvTSLwBu"
quipu_token = "KT1LzyPS8rN375tC31WPAVHaQ4HyBvTSLwBu"
price_feed = "KT1Qf46j2x37sAN4t2MKRQRVt9gc4FZ5duMs"

fee_collector = "tz1MDhGTfMQjtMYFXeasKzRWzkQKPtXEkSEw"
dummy_sig = "sigY3oZknG7z2N9bj5aWVtdZBakTviKnwbSYTecbbT2gwQDrnLRNhP5KDcLroggq71AjXWkx27nSLfS8rodS4DYn14FyueS5"

dev = "tz1fRXMLR27hWoD49tdtKunHyfy3CQb5XZst"

dummy_metadata = {
    "symbol": "0x01",
    "name": "0x02",
    "decimals": "0x03",
    "icon": "0x04",
}

fees = {
  "lp": 200_000,
  "stakers": 200_000,
  "ref": 500_000,
}

class Errors:
    PAST_DEADLINE = "'143'"
    DRAINED_PAIR = "'109'"
    LOW_TOKEN_A_IN = "'111'"
    LOW_TOKEN_B_IN = "'112'"
    HIGH_MIN_OUT = "'116'"
    WRONG_TEZ_AMOUNT = "'120'"

    AUCTION_INSUFFICIENT_BALANCE = "'307'"
    MIN_BID = "'308'"
    AUCTION_FINISHED = "'309'"
    
    NOT_A_NAT = "'406'"

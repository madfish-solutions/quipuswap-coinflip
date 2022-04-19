module Constants is {
  [@inline] const precision     : nat = 1_000_000_000_000_000_000n; (* 1e18 The precision to convert to *)
  [@inline] const no_operations : list(operation) = nil;
  [@inline] const max_random    : nat = 100n;
  [@inline] const win_threshold : nat = 50n;
}

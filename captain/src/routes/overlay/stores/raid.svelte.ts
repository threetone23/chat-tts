export function createRaidStore() {
  let raidedOut = $state(false);

  function markRaidedOut() {
    raidedOut = true;
  }

  return {
    get raidedOut() {
      return raidedOut;
    },
    markRaidedOut
  };
}

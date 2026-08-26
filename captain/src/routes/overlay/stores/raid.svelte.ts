export function createRaidStore() {
  let raidedOut = $state(false);

  function markRaidedOut() {
    raidedOut = true;
  }

  function resetRaidedOut() {
    raidedOut = false;
  }

  return {
    get raidedOut() {
      return raidedOut;
    },
    markRaidedOut,
    resetRaidedOut
  };
}

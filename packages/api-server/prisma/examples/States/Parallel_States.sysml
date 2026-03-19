package ParallelStates {

  action def PerformSelfTest;
  action def ProvidePower;
  action def ApplyParkingBrake;

  state def VehicleOperatingStates {
    entry;
    then off;

    state off;
    state starting;
    state on {
      entry action selfTest : PerformSelfTest;
      do action power : ProvidePower;
      exit action brake : ApplyParkingBrake;
    }

    transition off_starting
      first off then starting;
    transition starting_on
      first starting then on;
    transition on_off
      first on then off;
  }

  state def VehicleHealthStates {
    entry;
    then normal;

    state normal;
    state degraded;

    transition normal_degraded
      first normal then degraded;
    transition degraded_normal
      first degraded then normal;
  }

  state def VehicleStates parallel {
    state operatingStates : VehicleOperatingStates;
    state healthStates : VehicleHealthStates;
  }
}

package StateDefinitions {
  private import ScalarValues::*;

  action def WarmUp;
  action def Exercise;
  action def Cooldown;

  state def Exercising {
    entry action warmup : WarmUp;
    do action exercise : Exercise;
    exit action cooldown : Cooldown;
  }

  state def OnOff {
    entry;
    then off;

    state off;
    state on;

    transition off_on
      first off then on;
    transition on_off
      first on then off;
  }
}
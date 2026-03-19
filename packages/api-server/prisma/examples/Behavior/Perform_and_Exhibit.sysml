package PerformAndExhibit {

  action def Accelerate;
  action def Brake;
  action def Steer;

  state def DrivingStates {
    entry;
    then idle;

    state idle;
    state moving;
    state stopped;

    transition start_moving
      first idle then moving;
    transition stop
      first moving then stopped;
    transition resume
      first stopped then moving;
  }

  part def Vehicle {
    perform action accelerate : Accelerate;
    perform action brake : Brake;
    perform action steer : Steer;
    exhibit state drivingStates : DrivingStates;
  }
}

package UseCases {

  action def GetInVehicle;
  action def DriveToDestination;
  action def GetOutOfVehicle;

  use case def TransportPassenger {
    doc /* The vehicle transports a passenger from origin to destination. */
  }

  use case transportPassenger : TransportPassenger {
    action driverGetIn : GetInVehicle;
    action passengerGetIn : GetInVehicle;
    action drive : DriveToDestination;
    action driverGetOut : GetOutOfVehicle;
    action passengerGetOut : GetOutOfVehicle;

    first start then fork1;
    fork fork1;
    first fork1 then driverGetIn;
    first fork1 then passengerGetIn;
    first driverGetIn then join1;
    first passengerGetIn then join1;
    join join1;
    first join1 then drive;
    first drive then fork2;
    fork fork2;
    first fork2 then driverGetOut;
    first fork2 then passengerGetOut;
    first driverGetOut then join2;
    first passengerGetOut then join2;
    join join2;
    first join2 then done;
  }
}
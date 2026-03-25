package SendAcceptActions {
    item def VehicleStart;
    item def EngineStatus;

    part def Driver {
        port commandPort;
    }

    part def Vehicle {
        port controlPort;
    }

    action def StartVehicle {
        /* Driver sends a start command to the vehicle */
        event occurrence driverReady;
        event occurrence doorClosed;

        first doorClosed then driverReady;

        action turnOn send vs : VehicleStart to vehicle.controlPort;
        action waitForStart accept vs : VehicleStart;

        flow of VehicleStart from turnOn.vs to waitForStart.vs;

        action startEngine {
            in item vs : VehicleStart;
            out item es : EngineStatus;
        }

        action reportStatus send es : EngineStatus to driver.commandPort;
        action receiveStatus accept es : EngineStatus;

        message of VehicleStart from turnOn to waitForStart;
        message of EngineStatus from reportStatus to receiveStatus;
    }

    part driver : Driver;
    part vehicle : Vehicle;
}

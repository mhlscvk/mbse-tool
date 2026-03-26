package MessagesAndSequences {
    item def StartRequest;
    item def Acknowledgment;
    item def IgnitionSignal;
    item def RPMReading;
    item def DashboardUpdate;

    part def Driver {
        port commandPort;
    }

    part def Vehicle {
        port controlPort;
        part engine : Engine;
        part dashboard : Dashboard;
    }

    part def Engine {
        port enginePort;
    }

    part def Dashboard {
        port displayPort;
    }

    part driver : Driver;
    part vehicle : Vehicle;

    /* Event occurrences as triggers */
    event occurrence keyInserted;
    event occurrence engineRunning;

    action def VehicleStartupSequence {
        /* Step 1: Driver sends start request to vehicle */
        action sendStart send sr : StartRequest to vehicle.controlPort;
        action receiveStart accept sr : StartRequest;

        /* Step 2: Vehicle forwards ignition signal to engine */
        action sendIgnition send ig : IgnitionSignal to vehicle.engine.enginePort;
        action receiveIgnition accept ig : IgnitionSignal;

        /* Step 3: Engine reports RPM back to vehicle */
        action sendRPM send rpm : RPMReading to vehicle.controlPort;
        action receiveRPM accept rpm : RPMReading;

        /* Message sequence — defines the interaction diagram */
        message of StartRequest from driver.commandPort to vehicle.controlPort;
        message of IgnitionSignal from vehicle.controlPort to vehicle.engine.enginePort;
        message of RPMReading from vehicle.engine.enginePort to vehicle.controlPort;
        message of DashboardUpdate from vehicle.controlPort to vehicle.dashboard.displayPort;
        message of Acknowledgment from vehicle.controlPort to driver.commandPort;

        /* Temporal ordering of steps */
        first sendStart then sendIgnition;
        first sendIgnition then sendRPM;
    }
}

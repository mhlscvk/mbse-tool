package OccurrencesAndTemporal {
    /* Occurrence definitions model things that happen over time */
    occurrence def Accident;
    occurrence def MaintenanceCheck;

    occurrence roadIncident : Accident;
    occurrence scheduledService : MaintenanceCheck;

    /* Event occurrences as significant instants */
    event occurrence ignitionOn;
    event occurrence ignitionOff;
    event occurrence collisionDetected;

    part def Vehicle {
        part engine : Engine;
        part brakes : BrakeSystem;
    }

    part def Engine;
    part def BrakeSystem;

    /* Individual definition — a specific vehicle identity */
    individual def Vehicle_1 :> Vehicle;

    /* Individual usage with snapshots and timeslices */
    individual myVehicle : Vehicle_1 {
        /* Snapshots capture state at a point in time */
        snapshot t0 {
            /* Vehicle at rest before trip */
        }

        snapshot t1 {
            /* Vehicle at rest after trip */
        }

        /* Timeslice captures a span of time */
        timeslice trip {
            /* Vehicle is in motion during this period */
        }

        /* Temporal ordering */
        first t0 then trip;
        first trip then t1;
    }

    /* Messages between parts during an occurrence */
    item def BrakeCommand;
    item def StatusReport;

    action def EmergencyStop {
        in item collision : Accident;

        message of BrakeCommand from myVehicle.engine to myVehicle.brakes;
        message of StatusReport from myVehicle.brakes to myVehicle.engine;
    }
}

package ConnectionsFlowsOccurrences {
    /* Occurrence definitions model things that happen over time */
    occurrence def MaintenanceEvent;
    occurrence def StartupSequence;

    occurrence maintenanceCheck : MaintenanceEvent;
    occurrence systemBoot : StartupSequence;

    item def Fuel;
    item def Coolant;

    port def FuelOutPort {
        out item fuelFlow : Fuel;
    }

    port def FuelInPort {
        in item fuelFlow : Fuel;
    }

    /* Conjugated port definition */
    port def ConjFuelPort conjugates FuelOutPort;

    part def FuelTank {
        port fuelOut : FuelOutPort;
    }

    part def Engine {
        port fuelIn : FuelInPort;
        port coolantPort : ~FuelOutPort;
    }

    part def CoolingSystem {
        port coolantOut : FuelOutPort;
    }

    /* Flow definition */
    flow def FuelTransfer {
        end source : FuelTank;
        end target : Engine;
    }

    part def Vehicle {
        part fuelTank : FuelTank;
        part engine : Engine;
        part cooling : CoolingSystem;

        /* Connection usage */
        connection fuelLine : FuelTransfer
            connect fuelTank.fuelOut to engine.fuelIn;

        /* Flow usage with items */
        flow fuelFlow of Fuel from fuelTank.fuelOut to engine.fuelIn;

        /* Succession flow */
        succession flow coolantFlow of Coolant from cooling.coolantOut to engine.coolantPort;

        /* Interface usage */
        interface fuelInterface connect fuelTank.fuelOut to engine.fuelIn;

        /* Allocation usage */
        allocate engine to fuelTank;
    }
}
